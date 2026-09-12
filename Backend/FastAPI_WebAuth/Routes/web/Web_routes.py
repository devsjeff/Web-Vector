from fastapi import  Request ,APIRouter , HTTPException, status ,Response
from FastAPI_WebAuth.Routes.Types_pydantic import Email

from FastAPI_WebAuth.Auth.Mail import Send_otp
from FastAPI_WebAuth.db.web_db import check_user_exists ,create_user_account
from FastAPI_WebAuth.Cache.redis_webAuth import Set_email_with_otp ,Delete_Email_otp

from FastAPI_WebAuth.Routes.Types_pydantic import Token , LoginType ,SignupType
from FastAPI_WebAuth.Routes.config import limiter

WEBrouter  = APIRouter()

@WEBrouter.post("/Auth/SignupOTP")
@limiter.limit("3/min")
async def Home (request:Request , email:Email):
    result = check_user_exists(email.email)
    if result.get("operation_success") and not result.get("UserExist"):
        otp = await Send_otp(email.email)
        
        if otp.get("operation_success"):
            redis = await Set_email_with_otp(Email=email.email , otp=otp.get(otp))
            if redis.get("operation"):
                return
        
    if not result.get("operation_success"):
        return Response(status_code=500)
    if result.get("operation_success") and  result.get("UserExist"):
        return Response(status_code=409)
    
    
    
    
    
    
    
     