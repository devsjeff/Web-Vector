import copy

from httpx import ASGITransport, AsyncClient

from FastAPI_WebAuth.Main import app
from tests.conftest import CONFIG


def client(token: str | None = None) -> AsyncClient:
    cookies = {"access_token": token} if token else {}
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies)


async def test_not_logged_in_is_401():
    async with client() as c:
        assert (await c.post("/App/whatsapp_config", json=CONFIG)).status_code == 401
        assert (await c.get("/App/whatsapp_config")).status_code == 401


async def test_garbage_token_is_401():
    async with client("not.a.jwt") as c:
        assert (await c.get("/App/whatsapp_config")).status_code == 401


async def test_get_before_any_save(user):
    async with client(user["token"]) as c:
        body = (await c.get("/App/whatsapp_config")).json()
        assert body == {"configured": False, "config": None}


async def test_save_then_load_roundtrip(user):
    async with client(user["token"]) as c:
        assert (await c.post("/App/whatsapp_config", json=CONFIG)).json() == {"status": "saved"}
        body = (await c.get("/App/whatsapp_config")).json()
        assert body["configured"] is True
        assert body["config"] == CONFIG


async def test_saving_twice_updates_instead_of_failing(user):
    """The old code INSERTed every time, so the 2nd save crashed on the unique email."""
    async with client(user["token"]) as c:
        assert (await c.post("/App/whatsapp_config", json=CONFIG)).status_code == 200
        changed = copy.deepcopy(CONFIG)
        changed["task"] = "New task"
        changed["responseStyle"] = {"mode": "friendly", "customText": ""}
        assert (await c.post("/App/whatsapp_config", json=changed)).status_code == 200
        loaded = (await c.get("/App/whatsapp_config")).json()["config"]
        assert loaded["task"] == "New task"
        assert loaded["responseStyle"]["mode"] == "friendly"


async def test_custom_mode_without_text_is_422(user):
    bad = copy.deepcopy(CONFIG)
    bad["roleIdentity"] = {"mode": "custom", "customText": "   "}
    async with client(user["token"]) as c:
        assert (await c.post("/App/whatsapp_config", json=bad)).status_code == 422


async def test_empty_task_is_422(user):
    bad = copy.deepcopy(CONFIG)
    bad["task"] = "   "
    async with client(user["token"]) as c:
        assert (await c.post("/App/whatsapp_config", json=bad)).status_code == 422


async def test_token_of_deleted_user_is_401(user):
    from sqlalchemy import text
    from FastAPI_WebAuth.db.web_db import engine

    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": user["email"]})
    async with client(user["token"]) as c:
        assert (await c.post("/App/whatsapp_config", json=CONFIG)).status_code == 401
