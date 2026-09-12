from fastapi import APIRouter, HTTPException, Request, status

from FastAPI_WebAuth.Auth.Mail import Send_otp
from FastAPI_WebAuth.Cache.redis_webAuth import Set_email_with_otp
from FastAPI_WebAuth.Routes.Types_pydantic import Email
from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.db.web_db import check_user_exists


WEBrouter = APIRouter()


@WEBrouter.post("/Auth/SignupOTP")
@limiter.limit("3/min")
async def signup_otp(request: Request, email: Email):
    result = check_user_exists(email.email)
    if not result.get("operation_success"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to check account availability",
        )

    if result.get("UserExist"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    otp_result = await Send_otp(email.email)
    if not otp_result.get("operation_success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send verification email",
        )

    otp_value = otp_result.get("otp")
    if not otp_value:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Verification email did not contain a code",
        )

    redis_result = await Set_email_with_otp(
        Email=email.email,
        otp=otp_value,
    )
    if not redis_result.get("operation"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to store verification code",
        )

    return {"message": "OTP sent"}
