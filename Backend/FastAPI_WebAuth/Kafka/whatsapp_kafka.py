import asyncio
import json
import logging
import os

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.WhatsappAi import OPENRouter_ai
from FastAPI_WebAuth.db.App import Read_UserWtsAcc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
KAFKA = os.getenv("KAFKA_BROKERS", "localhost:9092")
INCOMING_TOPIC = os.getenv("KAFKA_TOPIC_INCOMING", "whatsapp.incoming")
OUTGOING_TOPIC = os.getenv("KAFKA_TOPIC_OUTGOING", "whatsapp.outgoing")
UNCONFIGURED_REPLY = "This WhatsApp assistant is not configured yet. Please contact the account owner."
TEMPORARY_ERROR_REPLY = "Sorry, I couldn't process that message right now. Please try again later."


async def create_reply(data: dict) -> str:
    for attempt in range(3):
        try:
            config = await Read_UserWtsAcc(data["email"])
            if config is None:
                return UNCONFIGURED_REPLY
            return await OPENRouter_ai(data["message"], config)
        except Exception:
            if attempt == 2:
                logger.exception("Could not create a reply for message %s", data["messageId"])
                return TEMPORARY_ERROR_REPLY
            logger.warning("Retrying message %s after a processing error", data["messageId"], exc_info=True)
            await asyncio.sleep(2**attempt)


async def main():
    consumer = AIOKafkaConsumer(
        INCOMING_TOPIC,
        bootstrap_servers=KAFKA.split(","),
        group_id=os.getenv("KAFKA_PYTHON_GROUP_ID", "webvector-whatsapp-python"),
        enable_auto_commit=False,
    )
    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA.split(","),
        value_serializer=lambda value: json.dumps(value).encode(),
    )

    await consumer.start()
    await producer.start()
    logger.info("WhatsApp Kafka worker is ready")
    try:
        async for record in consumer:
            try:
                data = json.loads(record.value.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                logger.error("Skipping malformed JSON at offset %s", record.offset)
                await consumer.commit()
                continue

            required = ("email", "chatWithNumber", "messageId", "message")
            if not isinstance(data, dict) or any(not data.get(key) for key in required):
                logger.error("Skipping malformed WhatsApp message at offset %s", record.offset)
                await consumer.commit()
                continue

            reply = await create_reply(data)

            await producer.send_and_wait(
                OUTGOING_TOPIC,
                {
                    "email": data["email"],
                    "chatWithNumber": data["chatWithNumber"],
                    "messageId": data["messageId"],
                    "reply": reply,
                },
                key=data["messageId"].encode(),
            )
            await consumer.commit()
            logger.info("Processed WhatsApp message %s for %s", data["messageId"], data["email"])
    finally:
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(main())