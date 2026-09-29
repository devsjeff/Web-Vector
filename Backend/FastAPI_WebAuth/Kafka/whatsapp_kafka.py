import asyncio
import json

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.WhatsappAi import OPENRouter_ai

KAFKA = "localhost:9092"


async def main():
    consumer = AIOKafkaConsumer("incoming", bootstrap_servers=KAFKA, group_id="py")
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA,
        value_serializer=lambda v: json.dumps(v).encode(),
    )

    await consumer.start()
    await producer.start()
    print("worker ready")

    async for msg in consumer:
        if msg.value is None:
            continue

        data = json.loads(msg.value)
        print("in:", data)

        reply = await OPENRouter_ai(data["message"])

        await producer.send_and_wait("outgoing", {
            "number": data["number"],
            "reply": reply,
        })
        print("out:", reply)

    # unreachable, but clean
    await consumer.stop()
    await producer.stop()


asyncio.run(main())