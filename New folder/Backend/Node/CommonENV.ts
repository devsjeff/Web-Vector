import "dotenv/config";

function get(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing env var: ${name}`);
    }
    return value;
}

export const env = {
    DATABASE_URL: get("DATABASE_URL"),
    REDIS_URL: get("REDIS_URL"),
    JWT_SECRET: get("JWT_SECRET"),

    MONGO_URL : get("MONGO_URL") ,

    KAFKA_BROKERS: get("KAFKA_BROKERS"),
    KAFKA_CLIENT_ID: get("KAFKA_CLIENT_ID"),
    KAFKA_GROUP_ID: get("KAFKA_GROUP_ID"),

    FASTIFY_PORT:get("FASTIFY_PORT") ,
    FASTIFY_CORS_HOST_ORIGIN: get("FASTIFY_CORS_HOST_ORIGIN"),
    FASTIFY_NODE_ENV:get("FASTIFY_NODE_ENV")
};

