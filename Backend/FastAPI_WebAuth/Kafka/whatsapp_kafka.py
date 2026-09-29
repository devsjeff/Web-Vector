"""
whatsapp_kafka.py - the Python worker: Kafka consumer + producer + LLM.

Run it from the Backend/ folder (in its own terminal, next to uvicorn and the Node server):

    python -m FastAPI_WebAuth.Kafka.whatsapp_kafka

Flow for every WhatsApp message:

  1. read IncomingEvent from topic  whatsapp.incoming     (Node put it there)
  2. load this user's saved settings from Postgres          (role, style, task, rules, language, memory)
  3. build system prompt + chat turns, ask the LLM
  4. write OutgoingEvent to topic   whatsapp.outgoing       (Node reads it and sends it on WhatsApp)
  5. commit the Kafka offset (only AFTER step 4, so a crash never silently loses a message)
"""
import asyncio
import json
import signal
import time
import uuid
from collections import defaultdict

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.admin import AIOKafkaAdminClient, NewTopic

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


# ====================================================================== 1. THE BRAIN (no Kafka in here)
async def process_event(event: IncomingEvent) -> OutgoingEvent | None:
    """One incoming WhatsApp message -> the reply to send (or None = do not reply)."""
    age_seconds = time.time() - event.created_at / 1000
    if age_seconds > EVENT_MAX_AGE_SECONDS:
        print(f"[worker] skip {event.event_id}: too old ({int(age_seconds)}s)")
        return None

    if event.chat_with_number == event.whatsapp_number:
        return None  # "message yourself" chat

    config = await Read_WhatsappConfig(event.email)
    if config is None:
        if await get_user_by_email(event.email) is None:
            print(f"[worker] skip {event.event_id}: no account found for {event.email}")
            return None
        config = DEFAULT_ASSISTANT_CONFIG
        print(f"[worker] {event.email} has no saved settings; using safe default assistant behavior")

    system_prompt = build_system_prompt(config, contact_name=event.contact_name, contact_number=event.chat_with_number, owner_number=event.whatsapp_number)
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


# ====================================================================== 2. KAFKA PLUMBING
async def ensure_topics() -> None:
    """Create both topics if they do not exist yet (safe to run every time)."""
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
    """Kafka in Docker needs a few seconds after `docker compose up`. Keep trying instead of crashing."""
    for attempt in range(1, attempts + 1):
        try:
            await start()
            return
        except Exception as e:
            print(f"[worker] {label} not ready ({attempt}/{attempts}): {e}")
            await asyncio.sleep(2)
    raise RuntimeError(f"{label}: could not connect to Kafka at {KAFKA_BROKERS}")


async def _handle_one(msg, producer: AIOKafkaProducer) -> None:
    try:
        event = IncomingEvent.model_validate(json.loads(msg.value))
    except Exception as e:
        print(f"[worker] bad message at offset {msg.offset}, skipped: {e}")
        return

    print(f"[worker] in : {event.email} <- {event.chat_with_number}: {event.message.text[:80]!r}")
    try:
        outgoing = await process_event(event)
    except Exception as e:
        # One failing message (LLM down, DB down ...) must never stop the whole worker.
        print(f"[worker] failed {event.event_id}: {type(e).__name__}: {e}")
        return

    if outgoing is None:
        return

    payload = json.dumps(outgoing.model_dump(by_alias=True)).encode()
    await producer.send_and_wait(KAFKA_TOPIC_OUTGOING, value=payload, key=msg.key)
    print(f"[worker] out: {outgoing.email} -> {outgoing.chat_with_number}: {outgoing.reply[:80]!r}")


async def _handle_chat_group(msgs: list, producer: AIOKafkaProducer) -> None:
    """All messages of ONE chat, strictly in order (so replies never overtake each other)."""
    for msg in msgs:
        await _handle_one(msg, producer)


async def run_worker() -> None:
    await _retry_start("topics", ensure_topics)

    consumer = AIOKafkaConsumer(
        KAFKA_TOPIC_INCOMING,
        bootstrap_servers=KAFKA_BROKERS,
        group_id=KAFKA_WORKER_GROUP_ID,
        enable_auto_commit=False,  # we commit ourselves, after the reply is written
        auto_offset_reset="earliest",  # first start: also read messages sent while the worker was down
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
        pass  # Windows: Ctrl+C raises KeyboardInterrupt instead

    print(f"[worker] ready - reading '{KAFKA_TOPIC_INCOMING}', writing '{KAFKA_TOPIC_OUTGOING}' (Kafka {KAFKA_BROKERS})")

    try:
        while not stop.is_set():
            batches = await consumer.getmany(timeout_ms=1000, max_records=20)
            messages = [m for partition_msgs in batches.values() for m in partition_msgs]
            if not messages:
                continue

            # Different chats are answered in parallel (LLM calls are slow), one chat is answered in order.
            by_chat = defaultdict(list)
            for m in messages:
                by_chat[m.key or b""].append(m)
            await asyncio.gather(*(_handle_chat_group(group, producer) for group in by_chat.values()))

            await consumer.commit()
    finally:
        print("[worker] stopping ...")
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        pass
