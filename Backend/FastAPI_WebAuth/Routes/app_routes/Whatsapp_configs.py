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
    if configs.role_identity is None:
        raise HTTPException(status_code=422, detail="Role identity is required")

    rules_instructions = configs.rules_instructions or ""
    response_style = configs.response_Style or ""
    task = configs.task or ""

    ok = await UserWtsAcc_Write(
        user_id_=payload["user_id"],
        WtAcc_=configs.wtAcc,
        email_=payload["email"],
        Role_identity_=configs.role_identity,
        Memory_Context_=configs.memory_Context or "",
        Rules_instructions_=rules_instructions,
        Response_Style_=response_style,
        Task_=task,
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Could not save config")
    return {"status": "saved"}