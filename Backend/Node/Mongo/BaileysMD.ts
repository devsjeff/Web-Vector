import makeWASocket, { type WASocket, type WAMessage } from "@whiskeysockets/baileys";
import { EventEmitter } from "node:events";
import {loadAuthStateForAccount,saveCredentialsForAccount,deleteAllAuthDataForAccount} from "../Baileys/CreateSession";

// ---------------- TYPES ----------------

export interface IncomingChatMessage {fromMe: boolean;remoteUser: string;      // cleaned phone / JID user part
  remoteJid: string;       // full WhatsApp JID
  messageId: string;text: string; timestamp: number;       // unix seconds
}

export type SessionConnectionState = "connecting" | "qr" | "open" | "closed";

export interface WhatsAppSession {
  email: string;
  socket: WASocket;
  connectionState: SessionConnectionState;
  latestQrCode: string | null;
  events: EventEmitter;
  pendingMessages: IncomingChatMessage[];
}

// ---------------- CONFIG ----------------

const MESSAGE_BATCH_SIZE = 20;

const sessionsByEmail = new Map<string, WhatsAppSession>();

// ---------------- MESSAGE HELPERS ----------------

function extractPlainTextFromBaileysMessage(baileysMessage: WAMessage): string {
  const content = baileysMessage.message;
  if (!content) return "";

  if (typeof content.conversation === "string") return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;

  return ""; // non-text messages ignored for now
}

function convertBaileysMessageToIncomingChatMessage(baileysMessage: WAMessage): IncomingChatMessage | null {
  const messageKey = baileysMessage.key;
  if (!messageKey.remoteJid || !messageKey.id) return null;

  const plainText = extractPlainTextFromBaileysMessage(baileysMessage);
  if (!plainText) return null;

  const remoteUser = messageKey.remoteJid.split("@")[0];
  const rawTimestamp = baileysMessage.messageTimestamp;
  const timestamp = typeof rawTimestamp === "number" ? rawTimestamp : Number(rawTimestamp ?? 0);

  return {
    fromMe: Boolean(messageKey.fromMe),
    remoteUser,
    remoteJid: messageKey.remoteJid,
    messageId: messageKey.id,
    text: plainText,
    timestamp,
  };
}

// ---------------- KAFKA HOOK (implement later) ----------------

async function publishMessageBatch(email: string, messages: IncomingChatMessage[]): Promise<void> {
  console.log(`[${email}] batch ready (${messages.length} messages) → would publish to Kafka`, messages);
  // TODO: await kafkaProducer.send({ topic: "whatsapp.messages", messages: [{ key: email, value: JSON.stringify(messages) }] });
}

function bufferMessageAndFlushIfReady(session: WhatsAppSession, incomingMessage: IncomingChatMessage) {
  session.pendingMessages.push(incomingMessage);

  if (session.pendingMessages.length >= MESSAGE_BATCH_SIZE) {
    const batchToPublish = session.pendingMessages.splice(0, session.pendingMessages.length);
    void publishMessageBatch(session.email, batchToPublish).catch((error) =>
      session.events.emit("error", error)
    );
  }
}

// ---------------- PUBLIC: START (OR REUSE) A SESSION ----------------

export async function startSessionForEmail(email: string): Promise<WhatsAppSession> {
  const existingSession = sessionsByEmail.get(email);
  if (existingSession) return existingSession;

  const authStateForAccount = await loadAuthStateForAccount(email);

  const whatsappSocket = makeWASocket({
    auth: authStateForAccount,
  });

  const session: WhatsAppSession = {
    email,
    socket: whatsappSocket,
    connectionState: "connecting",
    latestQrCode: null,
    events: new EventEmitter(),
    pendingMessages: [],
  };

  sessionsByEmail.set(email, session);

  // creds rotation
  whatsappSocket.ev.on("creds.update", async (updatedCredentials) => {
    try {
      await saveCredentialsForAccount(email, updatedCredentials);
    } catch (error) {
      session.events.emit("error", error);
    }
  });

  // connection / QR / open / close
  whatsappSocket.ev.on("connection.update", (update) => {
    if (update.qr) {
      session.connectionState = "qr";
      session.latestQrCode = update.qr;
      session.events.emit("qr", update.qr);
    }

    if (update.connection === "open") {
      session.connectionState = "open";
      session.latestQrCode = null;
      session.events.emit("open");
    }

    if (update.connection === "close") {
      session.connectionState = "closed";
      const closeReason = update.lastDisconnect?.error?.message;
      session.events.emit("close", closeReason);
    }
  });

  // incoming messages
  whatsappSocket.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;

    for (const baileysMessage of messages) {
      const incomingMessage = convertBaileysMessageToIncomingChatMessage(baileysMessage);
      if (!incomingMessage) continue;

      session.events.emit("message", incomingMessage);
      bufferMessageAndFlushIfReady(session, incomingMessage);
    }
  });

  return session;
}

// ---------------- PUBLIC: WAIT FOR FIRST QR ----------------

export async function waitForQrCode(email: string, timeoutMs = 30_000): Promise<string> {
  const session = await startSessionForEmail(email);

  if (session.latestQrCode) return session.latestQrCode;
  if (session.connectionState === "open") throw new Error("Session already connected; no QR needed.");

  return new Promise<string>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      session.events.off("qr", onQr);
      reject(new Error(`Timed out waiting for QR for ${email}`));
    }, timeoutMs);

    const onQr = (qrString: string) => {
      clearTimeout(timeoutHandle);
      session.events.off("qr", onQr);
      resolve(qrString);
    };

    session.events.once("qr", onQr);
  });
}

// ---------------- PUBLIC: READS ----------------

export function getSession(email: string): WhatsAppSession | undefined {
  return sessionsByEmail.get(email);
}

export function getSessionState(email: string): SessionConnectionState | "missing" {
  return sessionsByEmail.get(email)?.connectionState ?? "missing";
}

// ---------------- PUBLIC: CLOSE SOCKET, KEEP SESSION ----------------

export async function closeSessionForEmail(email: string): Promise<void> {
  const session = sessionsByEmail.get(email);
  if (!session) return;

  session.socket.end(undefined);
  sessionsByEmail.delete(email);
}

// ---------------- PUBLIC: LOGOUT + WIPE MONGO ----------------

export async function logoutSessionForEmail(email: string): Promise<number> {
  const session = sessionsByEmail.get(email);

  if (session) {
    try {
      await session.socket.logout();
    } catch (logoutError) {
      session.events.emit("error", logoutError);
    }
    sessionsByEmail.delete(email);
  }

  return deleteAllAuthDataForAccount(email);
}