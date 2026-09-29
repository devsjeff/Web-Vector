from fastapi import APIRouter, HTTPException, Request

from FastAPI_WebAuth.Auth.jwt import Verify_decode_token
from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.Routes.Types_pydantic import Configs_type
from FastAPI_WebAuth.db.App import Save_WhatsappConfig, Read_WhatsappConfig
from FastAPI_WebAuth.db.web_db import get_user_by_email

APP_ROUTER = APIRouter()


def _email_from_cookie(request: Request) -> str:
    """The login cookie holds a JWT whose `sub` is the user's email. 401 if missing / invalid."""
    token = request.cookies.get("access_token")
    if token is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    payload = Verify_decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Not logged in")
    return payload["sub"]


@APP_ROUTER.post("/App/whatsapp_config")
@limiter.limit("20/min")
async def update_whatsapp_config(request: Request, configs: Configs_type):
    """Save (create or update) the assistant behaviour: language, role, memory, rules, style, task."""
    email = _email_from_cookie(request)

    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=401, detail="Account not found")

    ok = await Save_WhatsappConfig(user_id=user.id, email=email, config=configs.model_dump())
    if not ok:
        raise HTTPException(status_code=500, detail="Could not save config")
    return {"status": "saved"}


@APP_ROUTER.get("/App/whatsapp_config")
@limiter.limit("60/min")
async def get_whatsapp_config(request: Request):
    """Load the saved behaviour so the settings card can show it (configured=False -> show defaults)."""
    email = _email_from_cookie(request)
    config = await Read_WhatsappConfig(email)
    return {"configured": config is not None, "config": config}
