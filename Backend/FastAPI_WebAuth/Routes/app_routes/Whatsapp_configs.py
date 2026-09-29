from fastapi import APIRouter, Request , Response , status , HTTPException
from FastAPI_WebAuth.Auth.jwt import  Verify_decode_token
from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.db.App import UserWtsAcc_Write

from FastAPI_WebAuth.Routes.Types_pydantic import Configs_type

APP_ROUTER  =  APIRouter()

@APP_ROUTER.post("/App/whatsapp_config")
@limiter.limit("1/min")
async def update_whatsapp_config(request: Request, configs: Configs_type):
    access_token = request.cookies.get("access_token")
    if access_token is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    payload = Verify_decode_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Not logged in")
    if not configs.roleIdentity.mode:
        raise HTTPException(status_code=422, detail="Role identity is required")
    if not configs.task.strip():
        raise HTTPException(status_code=422, detail="Task is required")

    def configured_value(field):
        return field.customText.strip() if field.mode == "custom" else field.mode

    fields = (
        configs.language,
        configs.roleIdentity,
        configs.memoryContext,
        configs.rulesInstructions,
        configs.responseStyle,
    )
    if any(not field.mode.strip() for field in fields):
        raise HTTPException(status_code=422, detail="All assistant settings are required")
    if any(field.mode == "custom" and not field.customText.strip() for field in fields):
        raise HTTPException(status_code=422, detail="Custom settings cannot be empty")

    ok = await UserWtsAcc_Write(
        email_=payload["sub"],
        Language_=configured_value(configs.language),
        Role_identity_=configured_value(configs.roleIdentity),
        Memory_Context_=configured_value(configs.memoryContext),
        Rules_instructions_=configured_value(configs.rulesInstructions),
        Response_Style_=configured_value(configs.responseStyle),
        Task_=configs.task.strip(),
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Could not save config")
    return {"status": "saved"}