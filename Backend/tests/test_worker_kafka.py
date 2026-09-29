"""
Integration test of the Python worker with REAL Kafka + REAL Postgres (a fake LLM server stands in for OpenRouter).

    docker compose up -d postgres kafka
    cd Backend && pytest tests/test_worker_kafka.py

Flow tested:  IncomingEvent -> Kafka -> worker -> Postgres settings -> LLM -> Kafka -> OutgoingEvent
"""
import asyncio
import json
import os
import socket
import subprocess
import sys
import time
import uuid

import httpx
import pytest
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from sqlalchemy import text

from FastAPI_WebAuth.Common_configs import KAFKA_BROKERS
from FastAPI_WebAuth.db.App import Save_WhatsappConfig
from FastAPI_WebAuth.db.web_db import engine
from tests.conftest import CONFIG

LLM_URL = "http://127.0.0.1:9911"


def _kafka_up() -> bool:
    host, port = KAFKA_BROKERS.split(",")[0].split(":")
    try:
        socket.create_connection((host, int(port)), timeout=1).close()
        return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(not _kafka_up(), reason="Kafka is not running")


@pytest.fixture
def fake_llm():
    proc = subprocess.Popen([sys.executable, "-m", "tests.fake_llm"])
    for _ in range(50):
        try:
            httpx.get(f"{LLM_URL}/_requests", timeout=0.5)
            break
        except Exception:
            time.sleep(0.2)
    yield
    proc.terminate()
    proc.wait(timeout=10)


@pytest.fixture
def worker():
    """Starts the real worker process with its own topics + group so tests never touch real data."""
    run = uuid.uuid4().hex[:8]
    topics = {"in": f"test.incoming.{run}", "out": f"test.outgoing.{run}"}
    env = {
        **os.environ,
        "KAFKA_TOPIC_INCOMING": topics["in"],
        "KAFKA_TOPIC_OUTGOING": topics["out"],
        "KAFKA_WORKER_GROUP_ID": f"test-worker-{run}",
        "LLM_BASE_URL": LLM_URL,
        "LLM_API_KEY": "fake-key",
        "PYTHONUNBUFFERED": "1",
    }
    log = open(f"/tmp/worker-{run}.log", "w") if os.name != "nt" else None
    proc = subprocess.Popen([sys.executable, "-m", "FastAPI_WebAuth.Kafka.whatsapp_kafka"], env=env, stdout=log, stderr=subprocess.STDOUT)
    yield topics
    proc.terminate()
    proc.wait(timeout=15)


def make_event(email: str, text_: str, history=None, age_ms: int = 0) -> dict:
    now_ms = int(time.time() * 1000)
    return {
        "eventId": str(uuid.uuid4()),
        "createdAt": now_ms - age_ms,
        "email": email,
        "whatsappNumber": "918888888888",
        "chatJid": "919999999999@s.whatsapp.net",
        "chatWithNumber": "919999999999",
        "contactName": "Rahul",
        "history": history or [],
        "message": {"messageId": "MSG-" + uuid.uuid4().hex[:6], "fromMe": False, "text": text_, "timestamp": now_ms // 1000},
    }


async def produce(topic: str, event: dict, key: str):
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BROKERS)
    await producer.start()
    try:
        await producer.send_and_wait(topic, json.dumps(event).encode(), key=key.encode())
    finally:
        await producer.stop()


async def read_outgoing(topic: str, expected: int, timeout: float = 40.0) -> list[dict]:
    consumer = AIOKafkaConsumer(topic, bootstrap_servers=KAFKA_BROKERS, auto_offset_reset="earliest", group_id=None)
    for _ in range(30):  # the worker creates the topic on start
        try:
            await consumer.start()
            break
        except Exception:
            await asyncio.sleep(1)
    out: list[dict] = []
    try:
        deadline = time.time() + timeout
        while len(out) < expected and time.time() < deadline:
            batch = await consumer.getmany(timeout_ms=500)
            out += [json.loads(m.value) for msgs in batch.values() for m in msgs]
    finally:
        await consumer.stop()
    return out


@pytest.fixture
async def configured_user():
    from FastAPI_WebAuth.db.web_db import create_user_account, get_user_by_email, init_db

    await init_db()
    email = f"kafka-{uuid.uuid4().hex[:8]}@example.com"
    await create_user_account(email=email, password="x")
    user = await get_user_by_email(email)
    assert await Save_WhatsappConfig(user_id=user.id, email=email, config=CONFIG)
    yield email
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
    await engine.dispose()


@pytest.fixture
async def unconfigured_user():
    from FastAPI_WebAuth.db.web_db import create_user_account, init_db

    await init_db()
    email = f"default-{uuid.uuid4().hex[:8]}@example.com"
    result = await create_user_account(email=email, password="x")
    assert result["operation_success"], result
    yield email
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
    await engine.dispose()


async def test_full_roundtrip_uses_saved_settings_and_history(fake_llm, worker, configured_user):
    email = configured_user
    history = [
        {"messageId": "H1", "fromMe": False, "text": "hi, do you cut beards?", "timestamp": 1},
        {"messageId": "H2", "fromMe": True, "text": "Yes we do!", "timestamp": 2},
    ]
    await produce(worker["in"], make_event(email, "how much for a haircut?", history), key=f"{email}:919999999999")

    out = await read_outgoing(worker["out"], expected=1)
    assert len(out) == 1, "worker did not answer in time"
    reply = out[0]
    assert reply["reply"] == "[fake-llm] how much for a haircut?"
    assert reply["email"] == email
    assert reply["chatJid"] == "919999999999@s.whatsapp.net"  # Node needs this to send it to the right chat
    assert reply["inReplyTo"].startswith("MSG-")

    # What did the LLM actually receive?
    seen = httpx.get(f"{LLM_URL}/_requests").json()[-1]["messages"]
    system = seen[0]["content"]
    assert seen[0]["role"] == "system"
    assert "Booking assistant for Glow Salon" in system  # role from Postgres
    assert "Book haircut appointments" in system  # task from Postgres
    assert "Never offer discounts" in system  # rules from Postgres
    assert "Hinglish" in system and "sarcasm" in system  # language + style from Postgres
    assert [m["role"] for m in seen[1:]] == ["user", "assistant", "user"]  # chat history kept in order
    assert seen[1]["content"] == "hi, do you cut beards?"


async def test_user_without_saved_settings_gets_safe_default_reply(fake_llm, worker, unconfigured_user):
    email = unconfigured_user
    await produce(worker["in"], make_event(email, "hello?"), key=f"{email}:919999999999")

    out = await read_outgoing(worker["out"], expected=1)
    assert len(out) == 1
    assert out[0]["reply"] == "[fake-llm] hello?"
    assert out[0]["email"] == email

    seen = httpx.get(f"{LLM_URL}/_requests").json()[-1]["messages"][0]["content"]
    assert "friendly personal assistant" in seen
    assert "do not invent facts or make commitments" in seen


async def test_unknown_user_stays_silent(fake_llm, worker):
    email = f"nobody-{uuid.uuid4().hex[:6]}@example.com"
    await produce(worker["in"], make_event(email, "hello?"), key="k")
    assert await read_outgoing(worker["out"], expected=1, timeout=8) == []


async def test_old_events_are_not_answered(fake_llm, worker, configured_user):
    await produce(worker["in"], make_event(configured_user, "old news", age_ms=3_600_000), key="k")
    assert await read_outgoing(worker["out"], expected=1, timeout=8) == []


async def test_worker_survives_llm_failure_and_garbage(fake_llm, worker, configured_user):
    email = configured_user
    httpx.post(f"{LLM_URL}/_fail_next", params={"count": 10})  # more than the openai client's retries
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BROKERS)
    await producer.start()
    await producer.send_and_wait(worker["in"], b"this is not json", key=b"k")
    await producer.stop()
    await produce(worker["in"], make_event(email, "first (LLM is failing)"), key="k")
    await asyncio.sleep(12)
    httpx.post(f"{LLM_URL}/_fail_next", params={"count": 0})
    await produce(worker["in"], make_event(email, "second (LLM is back)"), key="k")

    out = await read_outgoing(worker["out"], expected=2, timeout=30)
    assert [o["reply"] for o in out] == [
        "[fake-llm] first (LLM is failing)",
        "[fake-llm] second (LLM is back)",
    ]
