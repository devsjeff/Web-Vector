from redis.asyncio import Redis
from FastAPI_WebAuth.Common_configs import REDIS_URL

redis = Redis.from_url(REDIS_URL , decode_responses=True )

def Set_email_with_otp(Email:str , otp:str , Expiry_in_Sec :int = 300)  -> dict:
    try:
        redis.set(Email,otp ,Exp)
        return {"operation":True}
    except Exception as e:
        return {"operation":False , "error":str(e)}
        
    