// ============================================================================
// CreateSession.ts
//
// Runs the LIVE WhatsApp sessions (one Baileys socket per user email).
// Read this file top to bottom. Every section has ONE job:
//
//   SECTION 1  Settings            numbers you can change
//   SECTION 2  Memory store        Maps that hold live sessions (RAM only, not Mongo)
//   SECTION 3  Small helpers       phone number, message text, message converter
//   SECTION 4  Message buffer      save each incoming message in a variable, per chat
//   SECTION 5  Push 30 messages    when a chat reaches 30 messages, push them out (Kafka goes here)
//   SECTION 6  Socket events       what happens on: creds update / QR / open / close / new message
//   SECTION 7  Create a session    build the socket + reconnect when the connection drops
//   SECTION 8  Public functions    used by BaileysApi.ts (the file Fastify calls)
//
// Message flow:
//   WhatsApp -> SECTION 6 -> SECTION 3 (convert) -> SECTION 4 (save) -> SECTION 5 (push) -> Kafka
// ============================================================================

import makeWASocket, { DisconnectReason, type AuthenticationState, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { EventEmitter } from "node:events";
import { loadAuthState, saveCredentials, deleteAuthState } from "../Mongo/mongoBaileysSession.ts";
import type { ChatMessage, MessageBatch, WhatsAppSession } from "./BaileysTypes.ts";





// ============================================================================
// SECTION 1: SETTINGS
// ============================================================================

// How many messages of ONE chat we collect before pushing them out.
const MESSAGE_BATCH_SIZE = 30;

// How long we wait for a QR code before giving up.
const QR_TIMEOUT_MS = 30_000;

// After a dropped connection, wait this long before connecting again.
const RECONNECT_DELAY_MS = 3_000;





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
  const content = message.message;

  if (!content) return "";
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;

  return "";
}


// The small result we get after converting one Baileys message.
interface ConvertedMessage {
  chatWithNumber: string;
  message: ChatMessage;
}


// Converts a big Baileys message into our small ChatMessage. Returns null if we want to skip it.
function convertMessage(baileysMessage: WAMessage): ConvertedMessage | null {
  const messageId = baileysMessage.key.id;

  // Newer Baileys can give an "@lid" chat id. The real phone-number id is then in remoteJidAlt.
  const remoteJid = baileysMessage.key.remoteJid;
  const alternativeJid = (baileysMessage.key as { remoteJidAlt?: string }).remoteJidAlt;
  const jid = remoteJid?.endsWith("@lid") ? alternativeJid : remoteJid;

  // No chat id or no message id -> useless for us, skip.
  if (!jid || !messageId) return null;

  // For now we only handle direct person-to-person chats (no groups, no status updates).
  if (!jid.endsWith("@s.whatsapp.net")) return null;

  // Photos / stickers / voice notes without text -> skip.
  const text = getText(baileysMessage);
  if (!text) return null;

  const chatWithNumber = getPhoneNumber(jid);
  if (!chatWithNumber) return null;

  // messageTimestamp can be a number or a "Long" object. Number() turns both into a plain number.
  const timestamp = Number(baileysMessage.messageTimestamp ?? 0);
  const message: ChatMessage = { messageId, fromMe: Boolean(baileysMessage.key.fromMe), text, timestamp };

  return { chatWithNumber, message };
}





// ============================================================================
// SECTION 4: MESSAGE BUFFER
// Every incoming message is saved in a variable (session.messagesByChat), one list per chat.
//
//   messagesByChat
//   |-- "919999999999" -> [ msg1, msg2, msg3, ... ]   (person A has their own list)
//   `-- "918888888888" -> [ msg1, msg2, ... ]         (person B has their own list)
// ============================================================================

function saveMessageInBuffer(session: WhatsAppSession, chatWithNumber: string, message: ChatMessage) {
  // Find the list of this chat. If it does not exist yet, create an empty one.
  let chatMessages = session.messagesByChat.get(chatWithNumber);

  if (!chatMessages) {
    chatMessages = [];
    session.messagesByChat.set(chatWithNumber, chatMessages);
  }

  chatMessages.push(message);
}





// ============================================================================
// SECTION 5: PUSH 30 MESSAGES
// When ONE chat has 30 messages -> take them out of memory -> push them out.
// To connect Kafka later, you only edit sendBatchToKafka() below.
// ============================================================================

// 5A. Check the chat. If it has 30 messages, build a batch and push it.
async function pushBatchIfReady(session: WhatsAppSession, chatWithNumber: string) {
  const chatMessages = session.messagesByChat.get(chatWithNumber);
  const { email, whatsappNumber } = session;

  // No list yet, or fewer than 30 messages -> nothing to do.
  if (!chatMessages || chatMessages.length < MESSAGE_BATCH_SIZE) return;

  // We need our own number for the batch. If it is not known yet, keep the messages and try later.
  if (!whatsappNumber) return;

  // Take exactly 30 messages OUT of the list (they are removed from memory here).
  const batchMessages = chatMessages.splice(0, MESSAGE_BATCH_SIZE);
  const batch: MessageBatch = { email, whatsappNumber, chatWithNumber, messages: batchMessages };

  try {
    await sendBatchToKafka(batch);
  } catch (error) {
    // Push failed -> put the messages back at the front so NOTHING is lost. The next message tries again.
    chatMessages.unshift(...batchMessages);
    console.error("Could not push batch, will retry on the next message:", error);
  }
}


// 5B. The place where your Kafka code goes later.
async function sendBatchToKafka(batch: MessageBatch) {
  // TODO: replace the console.log below with your Kafka producer, for example:
  //   await producer.send({ topic: "whatsapp-messages", messages: [{ key: batch.email, value: JSON.stringify(batch) }] });
  //
  // If this function throws an error, the 30 messages go back into memory and are retried later.
  console.log("\n===== KAFKA BATCH =====");
  console.log(JSON.stringify(batch, null, 2));
  console.log("=======================\n");
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

  console.log(`[${session.email}] connection closed (code ${statusCode})`);

  // CASE 1: this session is finished for good -> clean up.
  if (wasLoggedOut || wasReplaced || qrNotScanned) {
    session.state = "closed";
    session.events.emit("close");
    sessions.delete(session.email);

    // A real logout means the saved login is useless now -> delete it from Mongo.
    if (wasLoggedOut) deleteAuthState(session.email).catch(logError("Could not delete auth state:"));

    return;
  }

  // CASE 2: the connection just dropped -> connect again with the SAME session object.
  // Important: right after the QR scan WhatsApp ALWAYS closes once with "restartRequired".
  // Without reconnecting here, the session would never become "open".
  const delay = statusCode === DisconnectReason.restartRequired ? 0 : RECONNECT_DELAY_MS;

  session.state = "connecting";
  session.qr = null;

  scheduleReconnect(session, authState, delay);
}


// 6E. A new WhatsApp message arrived.
async function handleIncomingMessages(session: WhatsAppSession, messages: WAMessage[], type: string) {
  // "notify" = brand new messages. Other types are old history -> skip.
  if (type !== "notify") return;

  for (const baileysMessage of messages) {
    // Turn the big Baileys message into our small one (or skip it).
    const converted = convertMessage(baileysMessage);
    if (!converted) continue;

    // Step 1: keep the message in memory (SECTION 4).
    saveMessageInBuffer(session, converted.chatWithNumber, converted.message);

    // Step 2: if this chat now has 30 messages, push them out (SECTION 5).
    await pushBatchIfReady(session, converted.chatWithNumber);
  }
}


// 6F. Connect all the events above to one socket.
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

// 7A. Build a brand new session for one user.
async function createNewSession(email: string): Promise<WhatsAppSession> {
  // Load the saved login from Mongo (or empty creds if this user never connected before).
  const authState = await loadAuthState(email);

  // Open the WhatsApp connection with that login.
  const socket = makeWASocket({ auth: authState });

  // The session object: everything we know about this user's WhatsApp.
  const session: WhatsAppSession = {
    email,
    socket,
    state: "connecting",
    qr: null,
    whatsappNumber: null,
    messagesByChat: new Map(),
    events: new EventEmitter(),
  };

  // Remember it in memory, then start listening to the socket (SECTION 6).
  sessions.set(email, session);
  attachListeners(session, socket, authState);

  return session;
}


// 7B. Connect again after a drop. Same session object, only the socket is new,
// so Fastify and the message buffers keep working.
function reconnectSession(session: WhatsAppSession, authState: AuthenticationState) {
  // The session was removed while we waited (for example the user logged out) -> stop.
  if (sessions.get(session.email) !== session) return;

  // We reuse the authState we already have in memory. It is always the newest one.
  // (Reading from Mongo here could give older data if the last save is still running.)
  const socket = makeWASocket({ auth: authState });

  session.socket = socket;
  attachListeners(session, socket, authState);
}


// 7C. Same as 7B, but after a small wait. If it fails, it tries again.
function scheduleReconnect(session: WhatsAppSession, authState: AuthenticationState, delayMs: number) {
  setTimeout(() => {
    try {
      reconnectSession(session, authState);
    } catch (error) {
      // Production tip: add a maximum retry count and a growing delay here.
      console.error("Reconnect failed, trying again:", error);
      scheduleReconnect(session, authState, RECONNECT_DELAY_MS);
    }
  }, delayMs);
}





// ============================================================================
// SECTION 8: PUBLIC FUNCTIONS (BaileysApi.ts uses these, Fastify never touches them directly)
// ============================================================================

// 8A. Start the session for this email (or reuse the one that already exists).
export async function startSession(email: string): Promise<WhatsAppSession> {
  // Already running -> reuse it.
  const existingSession = sessions.get(email);
  if (existingSession) return existingSession;

  // Another request is creating it right now -> wait for that one (do not create a second socket).
  const pendingStart = pendingStarts.get(email);
  if (pendingStart) return pendingStart;

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
    };

    const onQr = (qr: string) => {
      stopWaiting();
      resolve(qr);
    };

    const onOpen = () => {
      stopWaiting();
      resolve(null);
    };

    const timer = setTimeout(() => {
      stopWaiting();
      reject(new Error("Timed out waiting for QR"));
    }, timeoutMs);

    session.events.on("qr", onQr);
    session.events.on("open", onOpen);
  });
}


// 8C. Look at a session without starting one. Returns undefined if there is none.
export function getSession(email: string) {
  return sessions.get(email);
}


// 8D. Logout: close WhatsApp, forget the session, delete the saved login from Mongo.
export async function logoutSession(email: string) {
  const session = sessions.get(email);

  if (session) {
    // Remove from memory FIRST, so the "close" event that logout causes is ignored (see handleClose).
    sessions.delete(email);

    try {
      await session.socket.logout();
    } catch (error) {
      console.error("Baileys logout error:", error);
    }
  }

  await deleteAuthState(email);
}
