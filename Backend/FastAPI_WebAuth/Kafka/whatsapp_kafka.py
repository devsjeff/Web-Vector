"""
whatsapp_kafka.py - the Python worker: Kafka consumer + producer + LLM.

Run from the Backend/ folder:

    python -m FastAPI_WebAuth.Kafka.whatsapp_kafka

Flow:
  1. read IncomingEvent from topic  whatsapp.incoming
  2. load user settings from Postgres
  3. build prompt, ask the LLM
  4. write OutgoingEvent to topic   whatsapp.outgoing
  5. commit the Kafka offset (only AFTER step 4)
"""
import asyncio
import json
import signal
import time
import uuid

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from pydantic import ValidationError

from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.prompt_builder import DEFAULT_ASSISTANT_CONFIG, build_messages, build_system_prompt
from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.WhatsappAi import generate_reply
from FastAPI_WebAuth.Common_configs import (
    EVENT_MAX_AGE_SECONDS,
    KAFKA_BROKERS,
    KAFKA_TOPIC_INCOMING,
    KAFKA_TOPIC_OUTGOING,
    KAFKA_WORKER_GROUP_ID,
)
from FastAPI_WebAuth.db.App import Read_WhatsappConfig
from FastAPI_WebAuth.db.web_db import get_user_by_email
from FastAPI_WebAuth.Kafka.events import IncomingEvent, OutgoingEvent

RETRY_BASE_SECONDS = 2
RETRY_MAX_SECONDS = 30


async def process_event(event: IncomingEvent) -> OutgoingEvent | None:
    age_seconds = time.time() - event.created_at / 1000
    if age_seconds > EVENT_MAX_AGE_SECONDS:
        print(f"[worker] skip {event.event_id}: too old ({int(age_seconds)}s)")
        return None

    if event.chat_with_number and event.whatsapp_number and event.chat_with_number == event.whatsapp_number:
        return None

    config = await Read_WhatsappConfig(event.email)
    if config is None:
        if await get_user_by_email(event.email) is None:
            print(f"[worker] skip {event.event_id}: no account found for {event.email}")
            return None
        config = DEFAULT_ASSISTANT_CONFIG
        print(f"[worker] {event.email} has no saved settings; using safe default assistant behavior")

    system_prompt = build_system_prompt(
        config,
        contact_name=event.contact_name,
        contact_number=event.chat_with_number,
        owner_number=event.whatsapp_number,
    )
    history = [{"text": m.text, "from_me": m.from_me} for m in event.history]
    current = {"text": event.message.text, "from_me": False}
    messages = build_messages(system_prompt, history, current)

    reply = await generate_reply(messages)
    if not reply:
        print(f"[worker] skip {event.event_id}: the LLM returned an empty reply")
        return None

    return OutgoingEvent(
        event_id=str(uuid.uuid4()),
        created_at=int(time.time() * 1000),
        email=event.email,
        chat_jid=event.chat_jid,
        chat_with_number=event.chat_with_number,
        reply=reply,
        in_reply_to=event.message.message_id,
    )


async def ensure_topics() -> None:
    admin = AIOKafkaAdminClient(bootstrap_servers=KAFKA_BROKERS)
    await admin.start()
    try:
        existing = set(await admin.list_topics())
        missing = [t for t in (KAFKA_TOPIC_INCOMING, KAFKA_TOPIC_OUTGOING) if t not in existing]
        if missing:
            await admin.create_topics([NewTopic(name=t, num_partitions=1, replication_factor=1) for t in missing])
            print(f"[worker] created topics: {missing}")
    finally:
        await admin.close()


async def _retry_start(label: str, start, attempts: int = 30) -> None:
    for attempt in range(1, attempts + 1):
        try:
            await start()
            return
        except Exception as e:
            print(f"[worker] {label} not ready ({attempt}/{attempts}): {e}")
            await asyncio.sleep(2)
    raise RuntimeError(f"{label}: could not connect to Kafka at {KAFKA_BROKERS}")


async def _handle_one(msg, producer: AIOKafkaProducer) -> None:
    raw = msg.value
    if raw is None:
        print(f"[worker] empty message at offset {msg.offset}, skipped")
        return

    try:
        payload = json.loads(raw)
    except Exception as e:
        print(f"[worker] non-JSON message at offset {msg.offset}, skipped: {e}")
        return

    try:
        event = IncomingEvent.model_validate(payload)
    except ValidationError as e:
        details = "; ".join(
            f"{'.'.join(str(x) for x in err.get('loc', ()))}: {err.get('msg')}" for err in e.errors()[:5]
        )
        print(f"[worker] pydantic validation failed at offset {msg.offset}: {details}")
        return
    except Exception as e:
        print(f"[worker] bad message at offset {msg.offset}, skipped: {e}")
        return

    text_preview = (event.message.text or "")[:80]
    print(f"[worker] in : {event.email} <- {event.chat_with_number}: {text_preview!r}")
    outgoing = await process_event(event)

    if outgoing is None:
        return

    body = outgoing.model_dump(by_alias=True, mode="json")
    encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
    await producer.send_and_wait(KAFKA_TOPIC_OUTGOING, value=encoded, key=msg.key)
    print(f"[worker] out: {outgoing.email} -> {outgoing.chat_with_number}: {outgoing.reply[:80]!r}")


async def run_worker() -> None:
    await _retry_start("topics", ensure_topics)

    consumer = AIOKafkaConsumer(
        KAFKA_TOPIC_INCOMING,
        bootstrap_servers=KAFKA_BROKERS,
        group_id=KAFKA_WORKER_GROUP_ID,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
        value_deserializer=None,
    )
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BROKERS, acks="all")

    await _retry_start("consumer", consumer.start)
    await _retry_start("producer", producer.start)

    stop = asyncio.Event()
    try:
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop.set)
    except NotImplementedError:
        pass

    print(f"[worker] ready - reading '{KAFKA_TOPIC_INCOMING}', writing '{KAFKA_TOPIC_OUTGOING}' (Kafka {KAFKA_BROKERS})")

    retry_attempts: dict[tuple, int] = {}
    try:
        while not stop.is_set():
            batches = await consumer.getmany(timeout_ms=1000, max_records=1)
            for topic_partition, messages in batches.items():
                for msg in messages:
                    message_key = (topic_partition, msg.offset)
                    try:
                        await _handle_one(msg, producer)
                    except Exception as error:
                        attempt = retry_attempts.get(message_key, 0) + 1
                        retry_attempts[message_key] = attempt
                        delay = min(RETRY_BASE_SECONDS * 2 ** min(attempt - 1, 4), RETRY_MAX_SECONDS)
                        print(
                            f"[worker] retrying offset {msg.offset} in {delay}s after "
                            f"{type(error).__name__}: {error}"
                        )
                        consumer.seek(topic_partition, msg.offset)
                        await asyncio.sleep(delay)
                        break

                    await consumer.commit()
                    retry_attempts.pop(message_key, None)
    finally:
        print("[worker] stopping ...")
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        pass
