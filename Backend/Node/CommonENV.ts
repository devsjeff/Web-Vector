import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

function get(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing env var: ${name}`);
    }
    return value;
}

export const env = {
    MONGO_URL: get("MONGO_URL"),
    REDIS_URL: get("REDIS_URL"),
    JWT_SECRET: get("JWT_SECRET"),
    KAFKA_BROKERS: get("KAFKA_BROKERS"),
    KAFKA_CLIENT_ID: get("KAFKA_CLIENT_ID"),
    KAFKA_GROUP_ID: get("KAFKA_GROUP_ID"),
    KAFKA_TOPIC_INCOMING: process.env.KAFKA_TOPIC_INCOMING ?? "whatsapp.incoming",
    KAFKA_TOPIC_OUTGOING: process.env.KAFKA_TOPIC_OUTGOING ?? "whatsapp.outgoing",

    FASTIFY_PORT: process.env.FASTIFY_PORT ?? "3001",
    FASTIFY_CORS_HOST_ORIGIN: process.env.FASTIFY_CORS_HOST_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000",
    FASTIFY_NODE_ENV: process.env.FASTIFY_NODE_ENV ?? "development",
};

