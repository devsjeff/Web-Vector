const express = require("express");
const { Kafka } = require("kafkajs");

const app = express();
app.use(express.json());

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "node" });

// WhatsApp webhook → Kafka
app.post("/webhook", async (req, res) => {
  const { from, text, email } = req.body;

  await producer.send({
    topic: "incoming",
    messages: [{
      value: JSON.stringify({ email, number: from, message: text }),
    }],
  });

  res.sendStatus(200);
});

async function start() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: "outgoing" });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const { number, reply } = JSON.parse(message.value.toString());
      console.log(`→ ${number}: ${reply}`);
      // sendWhatsApp(number, reply)  ← plug your WhatsApp API here
    },
  });

  app.listen(3000, () => console.log("node :3000"));
}

start();