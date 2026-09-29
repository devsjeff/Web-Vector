// ============================================================================
// CommonENV.ts
//
// Reads Backend/.env ONCE and exports one typed `env` object. Every other Node file imports `env`
// from here (nobody reads process.env directly, so the .env file is always loaded first).
// Python reads the very same Backend/.env file.
// ============================================================================

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Backend/Node/CommonENV.ts  ->  ../.env  =  Backend/.env
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env"), quiet: true });

function text(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function number(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== undefined && process.env[name] !== "" ? value : fallback;
}

// Same default as Python (Common_configs.py) so both sides agree even without a .env in development.
const DEV_JWT_SECRET = "dev-only-secret-change-me-before-production-0123456789";

export const env = {
  NODE_ENV: text("FASTIFY_NODE_ENV", "development"),
  JWT_SECRET: text("JWT_SECRET", DEV_JWT_SECRET),

  FASTIFY_PORT: number("FASTIFY_PORT", 3001),
  CORS_ORIGINS: text("FASTIFY_CORS_HOST_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000").split(",").map((origin) => origin.trim()).filter(Boolean),

  MONGO_URL: text("MONGO_URL", "mongodb://localhost:27017"),
  MONGO_DB: text("MONGO_DB", "webvector"),
  REDIS_URL: text("REDIS_URL", "redis://localhost:6379/0"),

  KAFKA_BROKERS: text("KAFKA_BROKERS", "localhost:9092"),
  KAFKA_CLIENT_ID: text("KAFKA_CLIENT_ID", "web-vector-node"),
  KAFKA_GROUP_ID: text("KAFKA_GROUP_ID", "web-vector-node-replies"),
  KAFKA_TOPIC_INCOMING: text("KAFKA_TOPIC_INCOMING", "whatsapp.incoming"), // Node   -> Python
  KAFKA_TOPIC_OUTGOING: text("KAFKA_TOPIC_OUTGOING", "whatsapp.outgoing"), // Python -> Node
  EVENT_MAX_AGE_SECONDS: number("EVENT_MAX_AGE_SECONDS", 900), // replies older than this are never sent

  MAX_SESSIONS: number("MAX_SESSIONS", 10),
  HISTORY_SIZE: number("HISTORY_SIZE", 20),
  REPLY_DEBOUNCE_MS: number("REPLY_DEBOUNCE_MS", 2000),
  CONTACT_RATE_LIMIT_PER_MIN: number("CONTACT_RATE_LIMIT_PER_MIN", 5),
  MESSAGE_MAX_AGE_SECONDS: number("MESSAGE_MAX_AGE_SECONDS", 120), // ignore messages older than this (offline backlog)
};

if (env.NODE_ENV === "production" && env.JWT_SECRET === DEV_JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in Backend/.env when FASTIFY_NODE_ENV=production");
}
