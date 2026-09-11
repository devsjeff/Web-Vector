import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import qrcode from "qrcode-terminal";
import pino from "pino";

async function start() {

  // Hide Baileys internal logs
  const logger = pino({
    level: "silent"
  });

  // Load saved login
  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  // Create WhatsApp connection
  const sock = makeWASocket({
    auth: state,
    logger
  });

  // Save login/session changes
  sock.ev.on("creds.update", saveCreds);


  // Login / connection
  sock.ev.on("connection.update", (update) => {

    const { connection, qr, lastDisconnect } = update;

    // Not logged in → show QR
    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    // Successfully connected
    if (connection === "open") {
      console.log("✅ WhatsApp connected");
    }

    // Connection closed
    if (connection === "close") {

      const code =
        (lastDisconnect?.error as any)?.output?.statusCode;

      if (code === DisconnectReason.loggedOut) {
        console.log("❌ Logged out");
        return;
      }

      console.log("🔄 Reconnecting...");

      setTimeout(() => {
        start();
      }, 3000);
    }
  });


  // NEW MESSAGE
  sock.ev.on("messages.upsert", async ({ messages, type }) => {

    // Only new incoming messages
    if (type !== "notify") return;

    for (const message of messages) {

      // Ignore empty messages
      if (!message.message) continue;

      // Ignore our own messages
      if (message.key.fromMe) continue;


      // WHO sent it?
      const from = message.key.remoteJid;

      // WHAT did they send?
      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";


      console.log("From:", from);
      console.log("Message:", text);


      // Example reply
      if (from) {
        await sock.sendMessage(from, {
          text: `You said: ${text}`
        });
      }
    }
  });
}

start();