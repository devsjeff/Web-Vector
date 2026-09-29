// ============================================================================
// server.ts - starts everything on the Node side.
//
//   1. Fastify (HTTP API for the dashboard: QR, status, logout)
//   2. Kafka bridge (send WhatsApp messages to Python, get the AI reply back)
//   3. Restore saved WhatsApp sessions (users stay linked after a restart)
//
// Run from the project root:   npm start        (or  npm run dev  to restart on file changes)
// ============================================================================

import Fastify from "fastify";
import type { FastifyError } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import ratelimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";

import { env } from "../CommonENV.ts";
import { closeAllSessions, restoreSessions, sendReply } from "../Baileys/CreateSession.ts";
import { startKafka, stopKafka } from "../Kafka/baileys_kafka.ts";
import { closeMongo } from "../Mongo/Mongodb_Client.ts";
import { WhatsappRoutes } from "./Routes/Whatsapp/whatsappRoutes.ts";

// trustProxy=true only in production (behind nginx/cloud). In development anyone could fake the
// X-Forwarded-For header and dodge the rate limit.
const app = Fastify({ logger: true, trustProxy: env.NODE_ENV === "production", bodyLimit: 1_048_576 });

async function main() {
  await app.register(helmet, { global: true });
  await app.register(cookie);
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true, // lets the browser send the login cookie
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(ratelimit, { global: true, max: 30, timeWindow: "1 minute" });
  await app.register(sensible);

  await app.register(WhatsappRoutes);

  app.get("/health", async () => ({ ok: true }));

  // Every error becomes { statusCode, error, message } - the dashboard reads `message`.
  app.setErrorHandler((err: FastifyError & { expose?: boolean }, request, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) request.log.error(err);

    // 4xx and our own HttpError show the real message; unexpected 5xx bugs stay generic (no leaking internals).
    const message = status < 500 || err.expose ? err.message : "Internal Server Error";
    reply.status(status).send({ statusCode: status, error: message, message });
  });

  // Kafka first, so a WhatsApp message that arrives right after start can already be answered.
  await startKafka(sendReply);
  await app.listen({ port: env.FASTIFY_PORT, host: "0.0.0.0" });

  // Reconnect users who linked WhatsApp earlier. Runs in the background, the API is already up.
  restoreSessions().catch((error) => app.log.error(error, "restoreSessions failed"));
}

// Ctrl+C / docker stop: close sockets (logins stay saved), Kafka and Mongo cleanly.
async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  closeAllSessions();
  await app.close().catch(() => {});
  await stopKafka();
  await closeMongo().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
