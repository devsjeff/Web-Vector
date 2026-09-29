// ============================================================================
// baileys_kafka.ts - the Node side of the Kafka bridge (kafkajs).
//
//   publishIncoming(event)   Node -> Kafka topic "whatsapp.incoming"  (Python worker reads it)
//   startKafka(onReply)      Kafka topic "whatsapp.outgoing" -> onReply(event)  (Python's answer)
//
// (Before, this file was a copy-paste Express server that used require() inside an ES-module project,
//  had no WhatsApp connection, and used topic names / port 3000 that clashed with the frontend.)
// ============================================================================

import { Kafka, logLevel } from "kafkajs";
import { setTimeout as sleep } from "node:timers/promises";
import { env } from "../CommonENV.ts";
import { isOutgoingEvent, type IncomingEvent, type OutgoingEvent } from "./KafkaTypes.ts";

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()),
  logLevel: logLevel.NOTHING, // kafkajs is very chatty; we log what matters ourselves
  retry: { initialRetryTime: 300, retries: 8 },
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });

let running = false;

// ============================================================================
// SECTION 1: NODE -> PYTHON
// ============================================================================

// The key = "email:contactNumber". Kafka keeps messages with the same key in order,
// so one chat's messages are never processed out of order.
export async function publishIncoming(event: IncomingEvent): Promise<void> {
  await producer.send({ topic: env.KAFKA_TOPIC_INCOMING, messages: [{ key: `${event.email}:${event.chatWithNumber}`, value: JSON.stringify(event) }] });
}

// ============================================================================
// SECTION 2: PYTHON -> NODE
// ============================================================================

async function connectAndSubscribe(onReply: (event: OutgoingEvent) => Promise<void>) {
  // Create both topics if they do not exist yet (Python does the same, whoever starts first wins).
  const admin = kafka.admin();
  await admin.connect();
  try {
    const topics = [env.KAFKA_TOPIC_INCOMING, env.KAFKA_TOPIC_OUTGOING].map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 }));
    await admin.createTopics({ waitForLeaders: true, topics });
  } finally {
    await admin.disconnect();
  }

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: env.KAFKA_TOPIC_OUTGOING, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event: unknown = JSON.parse(message.value?.toString() ?? "null");

        if (!isOutgoingEvent(event)) return console.error("[kafka] ignoring a malformed reply");

        // Never send an old backlog to real people (for example after the server was down for hours).
        const ageSeconds = (Date.now() - event.createdAt) / 1000;
        if (ageSeconds > env.EVENT_MAX_AGE_SECONDS) return console.warn(`[kafka] dropping stale reply (${Math.round(ageSeconds)}s old)`);

        await onReply(event);
      } catch (error) {
        // One bad reply must never stop the consumer.
        console.error("[kafka] could not handle reply:", error);
      }
    },
  });
}

// Kafka in Docker needs some seconds to boot. Keep trying instead of crashing.
export async function startKafka(onReply: (event: OutgoingEvent) => Promise<void>) {
  if (running) return;

  for (let attempt = 1; ; attempt++) {
    try {
      await connectAndSubscribe(onReply);
      running = true;
      console.log(`[kafka] ready - writing '${env.KAFKA_TOPIC_INCOMING}', reading '${env.KAFKA_TOPIC_OUTGOING}' (${env.KAFKA_BROKERS})`);
      return;
    } catch (error) {
      if (attempt >= 30) throw error;
      console.warn(`[kafka] not ready (${attempt}/30): ${(error as Error).message}`);
      await sleep(2000);
    }
  }
}

export async function stopKafka() {
  if (!running) return;
  running = false;
  await consumer.disconnect().catch(() => {});
  await producer.disconnect().catch(() => {});
}
