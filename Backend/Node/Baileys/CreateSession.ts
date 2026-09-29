// ============================================================================
// CreateSession.ts
//
// Runs the LIVE WhatsApp sessions (one Baileys socket per user email).
// Read this file top to bottom. Every section has ONE job:
//
//   SECTION 1  Settings            numbers you can change
//   SECTION 2  Memory store        Maps that hold live sessions (RAM only, not Mongo)
//   SECTION 3  Small helpers       phone number, message text, message converter
//   SECTION 4  Incoming messages   WhatsApp message -> ChatPipeline (history, debounce) -> Kafka
//   SECTION 5  Send a reply        Python's answer (from Kafka) -> WhatsApp
//   SECTION 6  Socket events       what happens on: creds update / QR / open / close / new message
//   SECTION 7  Create a session    build the socket + reconnect (with growing delay) when the connection drops
//   SECTION 8  Public functions    used by BaileysApi.ts and server.ts
//
// The whole message flow:
//   WhatsApp -> SECTION 6 -> SECTION 3 (convert) -> SECTION 4 (ChatPipeline) -> Kafka -> Python + AI
//   Python + AI -> Kafka -> SECTION 5 (sendReply) -> WhatsApp
// ============================================================================

import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, normalizeMessageContent, type AuthenticationState, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { EventEmitter } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { pino } from "pino";
import { env } from "../CommonENV.ts";
import { HttpError } from "../HttpError.ts";
import { publishIncoming } from "../Kafka/baileys_kafka.ts";
import type { OutgoingEvent } from "../Kafka/KafkaTypes.ts";
import { deleteAuthState, listLinkedAccounts, loadAuthState, saveCredentials } from "../Mongo/mongoBaileysSession.ts";
import type { ChatMessage, WhatsAppSession } from "./BaileysTypes.ts";
import { addToHistory, clearChatTimers, defaultOptions, getChat, onContactMessage } from "./ChatPipeline.ts";





// ============================================================================
// SECTION 1: SETTINGS
// ============================================================================

// How long we wait for a QR code before giving up.
const QR_TIMEOUT_MS = 30_000;

// Reconnect delay grows: 3s, 6s, 12s ... up to 60s. After MAX_RECONNECT_ATTEMPTS failures in a row we give up.
const RECONNECT_BASE_DELAY_MS = 3_000;
const RECONNECT_MAX_DELAY_MS = 60_000;
const MAX_RECONNECT_ATTEMPTS = 8;

// Baileys is very chatty. "silent" = no Baileys logs at all (use "warn" or "debug" while debugging).
const baileysLogger = pino({ level: "silent" });





// ============================================================================
// SECTION 2: MEMORY STORE
// ============================================================================

// email -> live session. Lives only in Node memory (NOT in Mongo).
const sessions = new Map<string, WhatsAppSession>();

// email -> "this session is being created right now".
// Stops two quick requests from creating two sockets for the same user.
const pendingStarts = new Map<string, Promise<WhatsAppSession>>();





// ============================================================================
// SECTION 3: SMALL HELPERS
// ============================================================================

// Turns "919876543210:12@s.whatsapp.net" into "919876543210".
function getPhoneNumber(jid?: string | null) {
  if (!jid) return null;

  return jid.split("@")[0].split(":")[0];
}


// Returns a function that logs a failed promise, so an error never crashes Node.
// Usage: somePromise.catch(logError("what failed:"))
function logError(label: string) {
  return (error: unknown) => console.error(label, error);
}


// Pulls the text out of a Baileys message. Returns "" if the message has no text.
function getText(message: WAMessage) {
  // normalizeMessageContent unwraps "disappearing message" / "view once" wrappers.
  const content = normalizeMessageContent(message.message);

  if (!content) return "";
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;

  return "";
}


// The small result we get after converting one Baileys message.
interface ConvertedMessage {
  jid: string; // where replies go
  chatWithNumber: string;
  contactName: string | null;
  message: ChatMessage;
}


// Converts a big Baileys message into our small ChatMessage. Returns null if we want to skip it.
export function convertMessage(baileysMessage: WAMessage): ConvertedMessage | null {
  const messageId = baileysMessage.key.id;

  // Newer Baileys can give an "@lid" chat id. The real phone-number id is then in remoteJidAlt.
  // If there is no alternative, we still keep the "@lid" chat (replying to it works too).
  const remoteJid = baileysMessage.key.remoteJid;
  const alternativeJid = (baileysMessage.key as { remoteJidAlt?: string }).remoteJidAlt;
  const jid = remoteJid?.endsWith("@lid") && alternativeJid ? alternativeJid : remoteJid;

  // No chat id or no message id -> useless for us, skip.
  if (!jid || !messageId) return null;

  // For now we only handle direct person-to-person chats (no groups, no status updates, no broadcasts).
  if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) return null;

  // Photos / stickers / voice notes without text -> skip.
  const text = getText(baileysMessage);
  if (!text) return null;

  const chatWithNumber = getPhoneNumber(jid);
  if (!chatWithNumber) return null;

  // messageTimestamp can be a number or a "Long" object. Number() turns both into a plain number.
  const timestamp = Number(baileysMessage.messageTimestamp ?? 0);
  const fromMe = Boolean(baileysMessage.key.fromMe);
  const contactName = fromMe ? null : baileysMessage.pushName || null;

  return { jid, chatWithNumber, contactName, message: { messageId, fromMe, text, timestamp } };
}





// ============================================================================
// SECTION 4: INCOMING MESSAGES
// ============================================================================

export async function handleIncomingMessages(session: WhatsAppSession, messages: WAMessage[], type: string) {
  // "notify" = brand new messages, "append" = messages added to the chat list (also our own sent ones).
  // Anything else (old history sync) is skipped.
  if (type !== "notify" && type !== "append") return;

  for (const baileysMessage of messages) {
    const converted = convertMessage(baileysMessage);
    if (!converted) continue;

    const { jid, chatWithNumber, contactName, message } = converted;
    const chat = getChat(session, jid, chatWithNumber, contactName);

    // Our own messages (typed on the phone, or sent by the bot) only go into the history.
    if (message.fromMe) {
      addToHistory(chat, message);
      continue;
    }

    // Old messages (offline backlog after a reconnect) and "append" messages: remember them, but never answer them.
    const ageSeconds = Date.now() / 1000 - message.timestamp;
    if (type !== "notify" || ageSeconds > env.MESSAGE_MAX_AGE_SECONDS) {
      addToHistory(chat, message);
      continue;
    }

    // "Message yourself" chat: never answer that one (it would loop).
    if (chatWithNumber === session.whatsappNumber) continue;

    const result = onContactMessage(session, chat, message, publishIncoming);
    if (result === "rate_limited") console.warn(`[${session.email}] ${chatWithNumber} is over the message limit, ignoring`);
  }
}





// ============================================================================
// SECTION 5: SEND A REPLY (Python answered -> WhatsApp)
// ============================================================================

const ALLOWED_JID = /^\d+(:\d+)?@(s\.whatsapp\.net|lid)$/;

export async function sendReply(event: OutgoingEvent) {
  const session = sessions.get(event.email);

  if (!session || session.state !== "open") throw new Error(`no open WhatsApp session for ${event.email}`);

  // Only ever answer direct chats, whatever arrives on the topic.
  if (!ALLOWED_JID.test(event.chatJid)) throw new Error(`refusing to send to ${event.chatJid}`);

  if (!event.reply || !event.reply.trim()) throw new Error("empty reply, not sending");

  const sent = await session.socket.sendMessage(event.chatJid, { text: event.reply });

  // Remember our own reply in the history so the next question has the full conversation.
  const chat = session.chats.get(event.chatJid);
  if (chat && sent?.key.id) addToHistory(chat, { messageId: sent.key.id, fromMe: true, text: event.reply, timestamp: Math.floor(Date.now() / 1000) });

  console.log(`[${event.email}] replied to ${event.chatWithNumber}`);
}





// ============================================================================
// SECTION 6: SOCKET EVENTS
// Baileys tells us things ("creds changed", "here is a QR", "connection closed", "new message").
// Each thing has its own small function below.
// ============================================================================

// 6A. Login data changed -> save it to Mongo.
async function handleCredsUpdate(session: WhatsAppSession, authState: AuthenticationState) {
  // The session was already removed (logout) -> do not write anything back to Mongo.
  if (sessions.get(session.email) !== session) return;

  try {
    // The "creds.update" event only says WHAT changed (a partial object).
    // authState.creds already has the full, updated creds -> we save that one.
    await saveCredentials(session.email, authState.creds);
  } catch (error) {
    session.events.emit("session-error", error);
    console.error(`[${session.email}] could not save creds:`, error);
  }
}


// 6B. Baileys gave us a QR code -> remember it and tell whoever is waiting.
function handleQr(session: WhatsAppSession, qr: string) {
  session.state = "qr";
  session.qr = qr;
  session.events.emit("qr", qr);
}


// 6C. The user scanned the QR (or we reconnected) and WhatsApp is now connected.
function handleOpen(session: WhatsAppSession, socket: WASocket) {
  session.state = "open";
  session.qr = null;
  session.reconnectAttempts = 0;
  session.whatsappNumber = getPhoneNumber(socket.user?.id);
  session.events.emit("open");

  console.log(`[${session.email}] WhatsApp connected as ${session.whatsappNumber}`);
}


// 6D. The connection closed. Decide: clean up for good, or connect again.
function handleClose(session: WhatsAppSession, socket: WASocket, authState: AuthenticationState, error: unknown) {
  // Ignore if we removed this session on purpose (logout) or if this is an old socket we already replaced.
  if (sessions.get(session.email) !== session || session.socket !== socket) return;

  // Baileys hides the reason code inside error.output.statusCode.
  const statusCode = (error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;

  const wasLoggedOut = statusCode === DisconnectReason.loggedOut; // user removed the device on the phone
  const wasReplaced = statusCode === DisconnectReason.connectionReplaced; // same login opened somewhere else
  const qrNotScanned = session.state === "qr" && statusCode !== DisconnectReason.restartRequired; // QR expired, nobody scanned
  const isRestart = statusCode === DisconnectReason.restartRequired;

  console.log(`[${session.email}] connection closed (code ${statusCode})`);

  // A dropped connection is retried a limited number of times (the QR-scan restart does not count).
  if (!isRestart) session.reconnectAttempts += 1;
  const gaveUp = session.reconnectAttempts > MAX_RECONNECT_ATTEMPTS;

  // CASE 1: this session is finished for good -> clean up.
  if (wasLoggedOut || wasReplaced || qrNotScanned || gaveUp) {
    session.state = "closed";
    session.events.emit("close");
    sessions.delete(session.email);
    clearChatTimers(session);

    // A real logout means the saved login is useless now -> delete it from Mongo.
    // (If we only gave up reconnecting, the login stays saved, the next "Connect" or restart tries again.)
    if (wasLoggedOut) deleteAuthState(session.email).catch(logError("Could not delete auth state:"));

    if (gaveUp) console.error(`[${session.email}] gave up reconnecting after ${MAX_RECONNECT_ATTEMPTS} tries`);
    return;
  }

  // CASE 2: the connection just dropped -> connect again with the SAME session object.
  // Important: right after the QR scan WhatsApp ALWAYS closes once with "restartRequired".
  // Without reconnecting here, the session would never become "open".
  const delay = isRestart ? 0 : Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (session.reconnectAttempts - 1), RECONNECT_MAX_DELAY_MS);

  session.state = "connecting";
  session.qr = null;

  scheduleReconnect(session, authState, delay);
}


// 6E. Connect all the events above to one socket.
function attachListeners(session: WhatsAppSession, socket: WASocket, authState: AuthenticationState) {
  socket.ev.on("creds.update", () => {
    void handleCredsUpdate(session, authState); // has its own try/catch inside
  });

  socket.ev.on("connection.update", (update) => {
    if (update.qr) handleQr(session, update.qr);
    if (update.connection === "open") handleOpen(session, socket);
    if (update.connection === "close") handleClose(session, socket, authState, update.lastDisconnect?.error);
  });

  socket.ev.on("messages.upsert", ({ messages, type }) => {
    handleIncomingMessages(session, messages, type).catch(logError("Message handling failed:"));
  });
}





// ============================================================================
// SECTION 7: CREATE A SESSION + RECONNECT
// ============================================================================

// The WhatsApp Web version changes now and then. Using an old one gets the connection refused,
// so we ask Baileys for the newest (cached for 6 hours). If that fails we use the one built into Baileys.
let cachedVersion: { version: [number, number, number]; fetchedAt: number } | null = null;

async function getWhatsAppVersion() {
  if (cachedVersion && Date.now() - cachedVersion.fetchedAt < 6 * 60 * 60 * 1000) return cachedVersion.version;

  try {
    const latest = await Promise.race([fetchLatestBaileysVersion(), sleep(5_000).then(() => null)]);

    if (latest && !latest.error) {
      cachedVersion = { version: latest.version, fetchedAt: Date.now() };
      return latest.version;
    }
  } catch {
    // ignore, fall through
  }

  return undefined; // undefined = Baileys uses its built-in version
}


// Builds one Baileys socket from a saved login.
async function createSocket(authState: AuthenticationState): Promise<WASocket> {
  const version = await getWhatsAppVersion();

  return makeWASocket({
    auth: { creds: authState.creds, keys: makeCacheableSignalKeyStore(authState.keys, baileysLogger) }, // cache = far fewer Mongo reads
    logger: baileysLogger,
    version,
    browser: Browsers.macOS("Web Vector"),
    markOnlineOnConnect: false, // do not steal the "online" status from the phone
    syncFullHistory: false, // we do not need the old chats
    // Required by newer Baileys: without getMessage, retries/receipts can fail with 4xx disconnects.
    getMessage: async () => undefined,
  });
}


// 7A. Build a brand new session for one user.
async function createNewSession(email: string): Promise<WhatsAppSession> {
  // Load the saved login from Mongo (or empty creds if this user never connected before).
  const authState = await loadAuthState(email);

  // Open the WhatsApp connection with that login.
  const socket = await createSocket(authState);

  // The session object: everything we know about this user's WhatsApp.
  const session: WhatsAppSession = { email, socket, state: "connecting", qr: null, whatsappNumber: null, chats: new Map(), events: new EventEmitter(), reconnectAttempts: 0 };

  // Remember it in memory, then start listening to the socket (SECTION 6).
  sessions.set(email, session);
  attachListeners(session, socket, authState);

  return session;
}


// 7B. Connect again after a drop. Same session object, only the socket is new,
// so Fastify and the chat histories keep working.
async function reconnectSession(session: WhatsAppSession, authState: AuthenticationState) {
  // The session was removed while we waited (for example the user logged out) -> stop.
  if (sessions.get(session.email) !== session) return;

  // We reuse the authState we already have in memory. It is always the newest one.
  // (Reading from Mongo here could give older data if the last save is still running.)
  const socket = await createSocket(authState);

  // Removed while we were creating the socket -> throw the new socket away.
  if (sessions.get(session.email) !== session) return socket.end(undefined);

  session.socket = socket;
  attachListeners(session, socket, authState);
}


// 7C. Same as 7B, but after a small wait. If it fails, it tries again (with a limit).
function scheduleReconnect(session: WhatsAppSession, authState: AuthenticationState, delayMs: number) {
  setTimeout(() => {
    reconnectSession(session, authState).catch((error) => {
      console.error(`[${session.email}] reconnect failed:`, error);

      session.reconnectAttempts += 1;
      if (session.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        session.state = "closed";
        sessions.delete(session.email);
        clearChatTimers(session);
        return;
      }

      scheduleReconnect(session, authState, RECONNECT_BASE_DELAY_MS);
    });
  }, delayMs);
}





// ============================================================================
// SECTION 8: PUBLIC FUNCTIONS
// ============================================================================

// 8A. Start the session for this email (or reuse the one that already exists).
export async function startSession(email: string): Promise<WhatsAppSession> {
  // Already running -> reuse it.
  const existingSession = sessions.get(email);
  if (existingSession) return existingSession;

  // Another request is creating it right now -> wait for that one (do not create a second socket).
  const pendingStart = pendingStarts.get(email);
  if (pendingStart) return pendingStart;

  // Limit of live sockets (each one uses memory and a WhatsApp connection).
  if (sessions.size + pendingStarts.size >= env.MAX_SESSIONS) throw new HttpError(503, "The server is full right now. Please try again later.");

  // Otherwise create it. We remember the promise until it finishes.
  const newStart = createNewSession(email).finally(() => pendingStarts.delete(email));
  pendingStarts.set(email, newStart);

  return newStart;
}


// 8B. Wait until Baileys gives a QR code.
// Returns the QR text, or null if WhatsApp is already connected (no QR needed).
export async function waitForQrCode(email: string, timeoutMs = QR_TIMEOUT_MS): Promise<string | null> {
  const session = await startSession(email);

  // Fast answers first.
  if (session.state === "open") return null;
  if (session.qr) return session.qr;

  // Otherwise wait for the next "qr" event, or for "open" (a saved login connects without QR).
  return new Promise<string | null>((resolve, reject) => {
    const stopWaiting = () => {
      clearTimeout(timer);
      session.events.off("qr", onQr);
      session.events.off("open", onOpen);
      session.events.off("close", onClose);
    };

    const onQr = (qr: string) => {
      stopWaiting();
      resolve(qr);
    };

    const onOpen = () => {
      stopWaiting();
      resolve(null);
    };

    const onClose = () => {
      stopWaiting();
      reject(new HttpError(502, "Could not connect to WhatsApp. Please try again."));
    };

    const timer = setTimeout(() => {
      stopWaiting();
      reject(new HttpError(504, "WhatsApp did not send a QR code in time. Please try again."));
    }, timeoutMs);

    session.events.on("qr", onQr);
    session.events.on("open", onOpen);
    session.events.on("close", onClose);
  });
}


// 8C. Look at a session without starting one. Returns undefined if there is none.
export function getSession(email: string) {
  return sessions.get(email);
}


// 8D. Logout: close WhatsApp, forget the session, delete the saved login from Mongo.
export async function logoutSession(email: string) {
  // A session that is still being created: wait for it, so we do not leave a socket behind.
  await pendingStarts.get(email)?.catch(() => {});

  const session = sessions.get(email);

  if (session) {
    // Remove from memory FIRST, so the "close" event that logout causes is ignored (see handleClose).
    sessions.delete(email);
    clearChatTimers(session);

    try {
      // logout() tells WhatsApp to remove this linked device. It only works while connected.
      if (session.state === "open") await session.socket.logout();
      else session.socket.end(undefined);
    } catch (error) {
      console.error("Baileys logout error:", error);
    }

    session.state = "closed";
    session.events.emit("close");
  }

  await deleteAuthState(email);
}


// 8E. When the server starts: reconnect every user who linked WhatsApp before (no QR needed).
export async function restoreSessions() {
  const emails = await listLinkedAccounts();

  for (const email of emails.slice(0, env.MAX_SESSIONS)) {
    try {
      await startSession(email);
      console.log(`[${email}] restoring saved WhatsApp session`);
    } catch (error) {
      console.error(`[${email}] could not restore session:`, error);
    }

    await sleep(500); // a small gap so we do not open all sockets in the same second
  }
}


// 8F. When the server stops: close the sockets but KEEP the saved logins (users stay linked).
export function closeAllSessions() {
  for (const session of sessions.values()) {
    clearChatTimers(session);
    try {
      session.socket.end(undefined);
    } catch {
      // ignore
    }
  }

  sessions.clear();
}


// Test helper: put a fake session in the map (used by tests/e2e_bridge.e2e.ts, never by the app).
export function __setSessionForTests(session: WhatsAppSession) {
  sessions.set(session.email, session);
}
