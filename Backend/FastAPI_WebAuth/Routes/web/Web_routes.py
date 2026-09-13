from fastapi import APIRouter, HTTPException, Request,Response, status

from FastAPI_WebAuth.Auth.Mail import Send_otp_For_Signup
from FastAPI_WebAuth.Cache.redis_webAuth import Set_email_with_otp_Signup ,Verify_Delete_Email_otp_signup
from FastAPI_WebAuth.Routes.Types_pydantic import Email ,SignupType ,LoginType
from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.db.web_db import check_user_exists , create_user_account ,Login_email_pass_Get
from FastAPI_WebAuth.Auth.Argon2_pass import hash_password
from FastAPI_WebAuth.Auth.jwt import create_access_token 
from FastAPI_WebAuth.Common_configs import dev

WEBrouter = APIRouter()


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
async def Verify_Del_signup_otp(request:Request , response:Response,body: SignupType ):

    # 1) verify + consume OTP
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
    hashed_password = await hash_password(body.password)  
    result = await create_user_account(email=body.email,password=hashed_password)

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
    token = create_access_token(body.email)
    response.set_cookie(
    key="access_token",
    value=token,
    httponly=True,
    secure=dev,        # False in dev
    samesite="lax",
    max_age=60 * 60 * 24 * 2,
    path="/")
    return {"message": "Account created"}
    
    

@WEBrouter.post("/Auth/Login")
@limiter.limit("2/min")
async def LoginRoute(request:Request ,response:Response , body:LoginType):
    matched = await Login_email_pass_Get(email=body.email ,password=body.password)
    # print(f"debug matched={matched} type={type(matched)}") 
    if isinstance(matched,str):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail= "server errors"
        )
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED ,
            detail="Wrong email or password or maybe not Registered ")
    
    if matched :    
        token = create_access_token(body.email)
        response.set_cookie(
            key="access_token" ,
            value= token ,
            httponly= True,
            secure= dev ,
            samesite= "lax" ,
            max_age= 60 * 24  * 2,
            path="/"
        )
        return {"message": "Login successful"}
    
    
