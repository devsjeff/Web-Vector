"""
Shared test helpers. These tests use the REAL Postgres from docker-compose (docker compose up -d postgres).
Every test creates its own throw-away user and deletes it at the end.
"""
import uuid

import pytest
from sqlalchemy import text

from FastAPI_WebAuth.Auth.jwt import create_access_token
from FastAPI_WebAuth.db.web_db import create_user_account, engine, init_db

CONFIG = {
    "language": {"mode": "hinglish", "customText": ""},
    "roleIdentity": {"mode": "custom", "customText": "Booking assistant for Glow Salon"},
    "memoryContext": {"mode": "default", "customText": ""},
    "rulesInstructions": {"mode": "custom", "customText": "Never offer discounts. Salon is closed on Sundays."},
    "responseStyle": {"mode": "sarcastic", "customText": ""},
    "task": "Book haircut appointments and answer FAQs about prices.",
}


@pytest.fixture
async def user():
    """A fresh user row + a valid login token for it."""
    await init_db()
    email = f"test-{uuid.uuid4().hex[:10]}@example.com"
    result = await create_user_account(email=email, password="not-a-real-hash")
    assert result["operation_success"], result
    yield {"email": email, "token": create_access_token(email)}
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
    await engine.dispose()
