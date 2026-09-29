"""
Signup -> login -> cookie -> forgot-password against REAL Postgres + REAL Redis.
Only the Gmail sending is replaced (a test must never send real mail).
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from FastAPI_WebAuth.Cache import redis_webAuth
from FastAPI_WebAuth.Main import app
from FastAPI_WebAuth.Routes.web import Web_routes
from FastAPI_WebAuth.db.web_db import engine, init_db

PASSWORD = "secret-pass-1"


@pytest.fixture
async def email():
    await init_db()
    address = f"auth-{uuid.uuid4().hex[:8]}@example.com"
    yield address
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": address})
    await engine.dispose()


@pytest.fixture
def mail(monkeypatch):
    """Replaces the Gmail sender. `sent[email]` holds the OTP that would have been mailed."""
    sent: dict[str, str] = {}

    async def fake_send(address: str) -> dict:
        sent[address] = "123456"
        return {"operation_success": True, "otp": "123456"}

    monkeypatch.setattr(Web_routes, "Send_otp_For_Signup", fake_send)
    return sent


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_signup_login_and_cookie(email, mail):
    async with client() as c:
        assert (await c.post("/Auth/SignupSendOTP", json={"email": email})).status_code == 200
        assert email in mail

        bad = await c.post("/Auth/VerifySignOtpCreateAcc", json={"email": email, "otp": "000000", "password": PASSWORD})
        assert bad.status_code == 400  # wrong OTP

        ok = await c.post("/Auth/VerifySignOtpCreateAcc", json={"email": email, "otp": "123456", "password": PASSWORD, "first_name": "Dev"})
        assert ok.status_code == 200
        assert "access_token" in ok.cookies
        assert "httponly" in ok.headers["set-cookie"].lower()

        again = await c.post("/Auth/VerifySignOtpCreateAcc", json={"email": email, "otp": "123456", "password": PASSWORD})
        assert again.status_code == 400  # the OTP was single-use

        me = await c.get("/Auth")  # the client kept the cookie
        assert me.status_code == 200 and me.json() == {"authenticated": True, "email": email}

        assert (await c.post("/Auth/SignupSendOTP", json={"email": email})).status_code == 409  # already registered

    async with client() as fresh:
        assert (await fresh.post("/Auth/Login", json={"email": email, "password": "wrong-password"})).status_code == 401
        assert (await fresh.get("/Auth")).status_code == 401
        good = await fresh.post("/Auth/Login", json={"email": email, "password": PASSWORD})
        assert good.status_code == 200
        assert (await fresh.get("/Auth")).json()["email"] == email


async def test_forgot_password_resets_and_old_password_stops_working(email, mail):
    async with client() as c:
        await c.post("/Auth/SignupSendOTP", json={"email": email})
        await c.post("/Auth/VerifySignOtpCreateAcc", json={"email": email, "otp": "123456", "password": PASSWORD})

    async with client() as c:
        assert (await c.post("/Auth/Forgot_password_Otp", json={"email": email})).status_code == 200
        reset = await c.post("/Auth/Forget_pass_Reset", json={"email": email, "otp": "123456", "password": "brand-new-pass"})
        assert reset.status_code == 200

    async with client() as c:
        assert (await c.post("/Auth/Login", json={"email": email, "password": PASSWORD})).status_code == 401
        assert (await c.post("/Auth/Login", json={"email": email, "password": "brand-new-pass"})).status_code == 200


async def test_forgot_password_does_not_reveal_which_emails_exist(mail):
    async with client() as c:
        response = await c.post("/Auth/Forgot_password_Otp", json={"email": f"ghost-{uuid.uuid4().hex[:6]}@example.com"})
        assert response.status_code == 200
        assert response.json() == {"message": "If an account exists, an OTP has been sent"}
        assert mail == {}  # and no mail was sent
