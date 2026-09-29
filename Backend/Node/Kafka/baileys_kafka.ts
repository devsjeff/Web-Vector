// ============================================================================
// baileys_kafka.ts - the Node side of the Kafka bridge (kafkajs).
//
//   publishIncoming(event)   Node -> Kafka topic "whatsapp.incoming"  (Python worker reads it)
//   startKafka(onReply)      Kafka topic "whatsapp.outgoing" -> onReply(event)  (Python's answer)
// ============================================================================

import { Kafka, logLevel, type Producer, type Consumer } from "kafkajs";
import { setTimeout as sleep } from "node:timers/promises";
import { env } from "../CommonENV.ts";
import { isOutgoingEvent, type IncomingEvent, type OutgoingEvent } from "./KafkaTypes.ts";

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean),
  logLevel: logLevel.NOTHING,
  retry: { initialRetryTime: 300, retries: 8 },
});

let producer: Producer = kafka.producer();
let consumer: Consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });

let running = false;
let producerConnected = false;
let consumerConnected = false;

async function safeDisconnect(): Promise<void> {
  try {
    if (consumerConnected) await consumer.disconnect();
  } catch {
    /* ignore */
  }
  consumerConnected = false;

  try {
    if (producerConnected) await producer.disconnect();
  } catch {
    /* ignore */
  }
  producerConnected = false;
}

export async function publishIncoming(event: IncomingEvent): Promise<void> {
  if (!running || !producerConnected) {
    throw new Error("Kafka producer is not ready yet (startKafka has not finished)");
  }

  await producer.send({
    topic: env.KAFKA_TOPIC_INCOMING,
    messages: [
      {
        key: `${event.email}:${event.chatWithNumber}`,
        value: JSON.stringify(event),
      },
    ],
  });
}

async function ensureTopics(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [env.KAFKA_TOPIC_INCOMING, env.KAFKA_TOPIC_OUTGOING].map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
    });
  } finally {
    await admin.disconnect().catch(() => {});
  }
}

async function connectAndSubscribe(onReply: (event: OutgoingEvent) => Promise<void>): Promise<void> {
  // Clean slate so a previous failed attempt never leaves producer/consumer "already connected".
  await safeDisconnect();

  producer = kafka.producer();
  consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });

  await ensureTopics();

  await producer.connect();
  producerConnected = true;

  await consumer.connect();
  consumerConnected = true;

  await consumer.subscribe({ topic: env.KAFKA_TOPIC_OUTGOING, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const raw = message.value?.toString();
        if (!raw) {
          console.error("[kafka] ignoring empty reply payload");
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error("[kafka] ignoring non-JSON reply");
          return;
        }

        if (!isOutgoingEvent(parsed)) {
          console.error("[kafka] ignoring a malformed reply", parsed);
          return;
        }

        const ageSeconds = (Date.now() - parsed.createdAt) / 1000;
        if (ageSeconds > env.EVENT_MAX_AGE_SECONDS) {
          console.warn(`[kafka] dropping stale reply (${Math.round(ageSeconds)}s old)`);
          return;
        }

        await onReply(parsed);
      } catch (error) {
        console.error("[kafka] could not handle reply:", error);
      }
    },
  });
}

export async function startKafka(onReply: (event: OutgoingEvent) => Promise<void>): Promise<void> {
  if (running) return;

  for (let attempt = 1; ; attempt++) {
    try {
      await connectAndSubscribe(onReply);
      running = true;
      console.log(
        `[kafka] ready - writing '${env.KAFKA_TOPIC_INCOMING}', reading '${env.KAFKA_TOPIC_OUTGOING}' (${env.KAFKA_BROKERS})`,
      );
      return;
    } catch (error) {
      await safeDisconnect();
      if (attempt >= 30) throw error;
      console.warn(`[kafka] not ready (${attempt}/30): ${(error as Error).message}`);
      await sleep(2000);
    }
  }
}

export async function stopKafka(): Promise<void> {
  if (!running && !producerConnected && !consumerConnected) return;
  running = false;
  await safeDisconnect();
}
