"""Creates / removes the throw-away user + assistant settings used by run_e2e.sh.   python -m tests.e2e_setup setup|teardown EMAIL"""
import asyncio
import sys

from sqlalchemy import text

from FastAPI_WebAuth.db.App import Save_WhatsappConfig
from FastAPI_WebAuth.db.web_db import create_user_account, engine, get_user_by_email, init_db
from tests.conftest import CONFIG


async def main(action: str, email: str):
    await init_db()
    if action == "setup":
        await create_user_account(email=email, password="x")
        user = await get_user_by_email(email)
        assert await Save_WhatsappConfig(user_id=user.id, email=email, config=CONFIG)
    else:
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
    await engine.dispose()


asyncio.run(main(sys.argv[1], sys.argv[2]))
