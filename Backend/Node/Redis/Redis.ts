// ============================================================================
// Redis.ts  (not used by the server yet - ready for when you need a cache)
//
// Before: SetRedis wrote every value to the key "" (the `key` argument was ignored), and both functions
// threw the Error CLASS instead of an error, and the file connected at import time.
// Now: connects lazily on first use, uses the key you pass, and supports an optional expiry.
// ============================================================================

import { createClient } from "redis";
import { env } from "../CommonENV.ts";

const redisClient = createClient({ url: env.REDIS_URL });
redisClient.on("error", (error) => console.error("Redis error:", error));

async function connected() {
  if (!redisClient.isOpen) await redisClient.connect();
  return redisClient;
}

export async function SetRedis(key: string, value: object, expirySeconds?: number): Promise<void> {
  const client = await connected();
  await client.set(key, JSON.stringify(value), expirySeconds ? { EX: expirySeconds } : undefined);
}

export async function GetRedis<T = object>(key: string): Promise<T | null> {
  const client = await connected();
  const data = await client.get(key);
  return data === null ? null : (JSON.parse(data) as T);
}

export async function DeleteRedis(key: string): Promise<void> {
  const client = await connected();
  await client.del(key);
}
