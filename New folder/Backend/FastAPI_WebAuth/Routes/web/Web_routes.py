from fastapi import APIRouter, HTTPException, Request, Response, status

from FastAPI_WebAuth.Auth.Mail import Send_otp_For_Signup
from FastAPI_WebAuth.Cache.redis_webAuth import (
    Set_email_with_otp_Signup,
    Verify_Delete_Email_otp_signup,
    REDIS_OTP_Forgot_password,
    Verify_Delete_Email_otp_Forgot,
)
from FastAPI_WebAuth.Routes.Types_pydantic import Email, SignupType, LoginType
from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.db.web_db import (
    check_user_exists,
    create_user_account,
    Login_email_pass_Get,
    Update_user_account_pass,
)
from FastAPI_WebAuth.Auth.Argon2_pass import hash_password
from FastAPI_WebAuth.Auth.jwt import create_access_token, Verify_decode_token
from FastAPI_WebAuth.Common_configs import dev

WEBrouter = APIRouter()


def _set_auth_cookie(response: Response, token: str, max_age: int = 60 * 60 * 24 * 2):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=not dev,  # False on localhost (dev=True), True in production
        samesite="lax",
        max_age=max_age,
        path="/",
    )


@WEBrouter.post("/Auth/SignupSendOTP")
@limiter.limit("8/min")
async def signup_otp(request: Request, email: Email):
    result = await check_user_exists(email.email)
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

    otp_result = await Send_otp_For_Signup(email.email)

    if not otp_result.get("operation_success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=otp_result.get("error", "Unable to send verification email"),
        )

    otp_value = otp_result.get("otp")
    if not otp_value:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Verification email did not contain a code",
        )

    redis_result = await Set_email_with_otp_Signup(
        Email=email.email,
        otp=otp_value,
    )
    if not redis_result.get("operation"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to store verification code",
        )

    return {"message": "OTP sent"}


@WEBrouter.post("/Auth/VerifySignOtpCreateAcc")
@limiter.limit("1/min")
async def Verify_Del_signup_otp(
    request: Request, response: Response, body: SignupType
):
    otp_result = await Verify_Delete_Email_otp_signup(body.email, str(body.otp))

    if not otp_result.get("operation"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify OTP. Try again later.",
        )

    if not otp_result.get("match"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong or expired OTP",
        )

    try:
        hashed_password = await hash_password(body.password)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process password",
        )

    result = await create_user_account(
        email=body.email,
        password=hashed_password,
        name=body.first_name,
        last_name=body.last_name,
    )

    if not result.get("operation_success"):
        err = result.get("error", "")
        if err == "email_already_exists":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Account already exists. Please login.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create account",
        )

    try:
        token = create_access_token(body.email)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create session",
        )

    _set_auth_cookie(response, token)
    return {"message": "Account created"}


@WEBrouter.post("/Auth/Login")
@limiter.limit("2/min")
async def LoginRoutess(request: Request, response: Response, body: LoginType):
    matched = await Login_email_pass_Get(email=body.email, password=body.password)

    if matched is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server error. Please try again later.",
        )

    if not matched:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong email or password or maybe not Registered",
        )

    try:
        token = create_access_token(body.email)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create session",
        )

    _set_auth_cookie(response, token, max_age=60 * 60 * 24 * 2)
    return {"message": "Login successful"}


@WEBrouter.post("/Auth/Forgot_password_Otp")
@limiter.limit("1/min")
async def Forgot_pass_send_otp(request: Request, response: Response, body: Email):
    exist = await check_user_exists(body.email)

    if not exist.get("operation_success"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to check account. Try again later.",
        )

    # Always return the same message to avoid email enumeration
    if not exist.get("UserExist"):
        return {"message": "If an account exists, an OTP has been sent"}

    otp_result = await Send_otp_For_Signup(body.email)
    if not otp_result.get("operation_success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send verification email",
        )

    otp_value = otp_result.get("otp")
    if not otp_value:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send verification email",
        )

    redis_result = await REDIS_OTP_Forgot_password(body.email, otp=otp_value)
    if not redis_result.get("operation"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to store verification code",
        )

    return {"message": "If an account exists, an OTP has been sent"}


@WEBrouter.post("/Auth/Forget_pass_Reset")
@limiter.limit("1/min")
async def forget_pass_reset(
    request: Request, response: Response, body: SignupType
):
    otp_result = await Verify_Delete_Email_otp_Forgot(body.email, otp=body.otp)

    if not otp_result.get("operation"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify OTP. Try again later.",
        )

    if not otp_result.get("match"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong or expired OTP",
        )

    try:
        hashed = await hash_password(body.password)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process password",
        )

    done = await Update_user_account_pass(body.email, password=hashed)
    if not done:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update password",
        )

    try:
        token = create_access_token(body.email)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create session",
        )

    _set_auth_cookie(response, token)
    return {"message": "Password reset successful"}


@WEBrouter.get("/Auth")
@limiter.limit("30/min")
async def check_auth(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = Verify_decode_token(token=token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return {"authenticated": True, "email": payload.get("sub")}
