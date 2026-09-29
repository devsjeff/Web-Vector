import { Kafka } from "kafkajs";
import { env } from "../CommonENV.ts";
import type { IncomingMessage } from "../Baileys/BaileysTypes.ts";

export interface OutgoingMessage {
  email: string;
  chatWithNumber: string;
  messageId: string;
  reply: string;
}

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()),
});
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: `${env.KAFKA_GROUP_ID}-whatsapp-node` });

export async function publishIncomingMessage(message: IncomingMessage) {
  await producer.send({
    topic: env.KAFKA_TOPIC_INCOMING,
    messages: [{
      key: message.messageId,
      value: JSON.stringify(message),
    }],
  });
}

export async function startKafka(onOutgoingMessage: (message: OutgoingMessage) => Promise<void>) {
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: [env.KAFKA_TOPIC_INCOMING, env.KAFKA_TOPIC_OUTGOING].map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
      waitForLeaders: true,
    });
  } finally {
    await admin.disconnect();
  }

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: env.KAFKA_TOPIC_OUTGOING });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const outgoing = JSON.parse(message.value.toString()) as OutgoingMessage;
      if (
        !outgoing.email ||
        !outgoing.chatWithNumber ||
        !outgoing.messageId ||
        typeof outgoing.reply !== "string" ||
        !outgoing.reply.trim()
      ) {
        throw new Error("Received an invalid WhatsApp reply from Kafka");
      }

      await onOutgoingMessage(outgoing);
    },
  });
}

export async function stopKafka() {
  await Promise.all([consumer.disconnect(), producer.disconnect()]);
}