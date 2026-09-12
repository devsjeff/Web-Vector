from redis.asyncio import Redis
from FastAPI_WebAuth.Common_configs import REDIS_URL

redis = Redis.from_url(REDIS_URL , decode_responses=True )

async def Set_email_with_otp(Email:str , otp:str , Expiry_in_Sec :int = 300)  -> dict:
    try:
        await redis.set(f"otp:{Email}",otp , ex = Expiry_in_Sec)
        return {"operation":True}
    except Exception as e:
        return {"operation":False , "error":str(e)}
        
async def Delete_Email_otp(email:str ) -> dict :
    try :
        await redis.delete(f"otp:{email}")
        return {"operation":True}
    except Exception as e :
        return {"operation":False , "error":str(e)}


    