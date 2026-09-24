import makeWASocket, { type WAMessage } from "@whiskeysockets/baileys";
import { loadAuthState, saveCredentials, deleteAuthState } from "../Mongo/mongoBaileysSession.ts";
import type { ChatMessage, MessageBatch, WhatsAppSession } from "../Mongo/MongoTypes.ts"

const sessions = new Map<string, WhatsAppSession>();
const MESSAGE_BATCH_SIZE = 30;

function getPhoneNumber(jid?: string | null) {
  if (!jid) return null;
  return jid.split("@")[0].split(":")[0];
}

function getText(message: WAMessage) {
  const content = message.message;
  if (!content) return "";
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  return "";
}

function convertMessage(message: WAMessage): { chatWithNumber: string; message: ChatMessage } | null {
  const jid = message.key.remoteJid;
  const messageId = message.key.id;
  if (!jid ||!messageId) return null;

  // For now we only handle direct person-to-person chats.
  if (!jid.endsWith("@s.whatsapp.net")) return null;

  const text = getText(message);
  if (!text) return null;

  const timestampValue = message.messageTimestamp;
  const timestamp = typeof timestampValue === "number"? timestampValue : Number(timestampValue?? 0);

  return {
    chatWithNumber: getPhoneNumber(jid)!,
    message: { messageId, fromMe: Boolean(message.key.fromMe), text, timestamp },
  };
}

async function sendBatchToKafka(batch: MessageBatch) {
  // Kafka will be added here later.
  console.log("\n===== KAFKA BATCH =====");
  console.log(JSON.stringify(batch, null, 2));
  console.log("=======================\n");
}

async function addMessageToChatBuffer(session: WhatsAppSession, chatWithNumber: string, message: ChatMessage) {
  let messages = session.messagesByChat.get(chatWithNumber);
  if (!messages) {
    messages = [];
    session.messagesByChat.set(chatWithNumber, messages);
  }

  messages.push(message);
  if (messages.length < MESSAGE_BATCH_SIZE) return;

  const batchMessages = messages.splice(0, MESSAGE_BATCH_SIZE);

  if (!session.whatsappNumber) {
    console.error("WhatsApp number is not known yet");
    return;
  }

  const batch: MessageBatch = {
    email: session.email,
    whatsappNumber: session.whatsappNumber,
    chatWithNumber,
    messages: batchMessages,
  };

  await sendBatchToKafka(batch);
}

export async function startSession(email: string): Promise<WhatsAppSession> {
  const existingSession = sessions.get(email);
  if (existingSession) return existingSession;

  const authState = await loadAuthState(email);
  const socket = makeWASocket({ auth: authState });

  const session: WhatsAppSession = {
    email,
    socket,
    state: "connecting",
    qr: null,
    whatsappNumber: null,
    messagesByChat: new Map(),
    events: new (await import("node:events")).EventEmitter(),
  };

  sessions.set(email, session);

  socket.ev.on("creds.update", async (creds) => {
    try {
      // `creds.update` emits a partial update, while persistence requires the
      // complete credentials object. Baileys applies the update to authState.creds.
      await saveCredentials(email, authState.creds);
    } catch (error) {
      session.events.emit("session-error", error);
    }
  });

  socket.ev.on("connection.update", (update) => {
    if (update.qr) {
      session.state = "qr";
      session.qr = update.qr;
      session.events.emit("qr", update.qr);
    }

    if (update.connection === "open") {
      session.state = "open";
      session.qr = null;
      session.whatsappNumber = getPhoneNumber(socket.user?.id);
      session.events.emit("open");
    }

    if (update.connection === "close") {
      session.state = "closed";
      session.events.emit("close");
      sessions.delete(email);
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type!== "notify") return;

    for (const baileysMessage of messages) {
      const converted = convertMessage(baileysMessage);
      if (!converted) continue;
      await addMessageToChatBuffer(session, converted.chatWithNumber, converted.message);
    }
  });

  return session;
}

export async function waitForQrCode(email: string, timeoutMs = 30_000) {
  const session = await startSession(email);

  if (session.qr) return session.qr;
  if (session.state === "open") throw new Error("WhatsApp session is already connected");

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.events.off("qr", onQr);
      reject(new Error("Timed out waiting for QR"));
    }, timeoutMs);

    const onQr = (qr: string) => {
      clearTimeout(timeout);
      session.events.off("qr", onQr);
      resolve(qr);
    };

    session.events.once("qr", onQr);
  });
}

export function getSession(email: string) {
  return sessions.get(email);
}

export async function logoutSession(email: string) {
  const session = sessions.get(email);

  if (session) {
    try {
      await session.socket.logout();
    } catch (error) {
      console.error("Baileys logout error:", error);
    }
    sessions.delete(email);
  }

  await deleteAuthState(email);
}