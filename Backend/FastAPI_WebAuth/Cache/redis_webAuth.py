from redis.asyncio import Redis

from FastAPI_WebAuth.Common_configs import REDIS_URL

redis = Redis.from_url(REDIS_URL, decode_responses=True)


async def Set_email_with_otp_Signup(
    Email: str, otp: str, Expiry_in_Sec: int = 120
) -> dict:
    try:
        await redis.set(f"otp:{Email}", otp, ex=Expiry_in_Sec)
        return {"operation": True}
    except Exception as e:
        return {"operation": False, "error": str(e)}


async def Verify_Delete_Email_otp_signup(email: str, otp: str) -> dict:
    """
    Check OTP for email in Redis, delete it if it matches.
    RETURNS: {"operation": True,  "match": True}
             {"operation": True,  "match": False}
             {"operation": False, "error": str}
    """
    try:
        stored = await redis.get(f"otp:{email}")

        if stored is None:
            return {"operation": True, "match": False}

        if stored != str(otp):
            return {"operation": True, "match": False}

        await redis.delete(f"otp:{email}")
        return {"operation": True, "match": True}

    except Exception as e:
        return {"operation": False, "error": str(e)}


async def REDIS_OTP_Forgot_password(
    Email: str, otp: str, Expiry_in_Sec: int = 120
) -> dict:
    try:
        await redis.set(f"forgot_otp:{Email}", otp, ex=Expiry_in_Sec)
        return {"operation": True}
    except Exception as e:
        return {"operation": False, "error": str(e)}


async def Verify_Delete_Email_otp_Forgot(email: str, otp: str) -> dict:
    """
    RETURNS: {"operation": True, "match": True/False}
             {"operation": False, "error": str}
    """
    try:
        stored = await redis.get(f"forgot_otp:{email}")

        if stored is None:
            return {"operation": True, "match": False}

        if stored != str(otp):
            return {"operation": True, "match": False}

        await redis.delete(f"forgot_otp:{email}")
        return {"operation": True, "match": True}

    except Exception as e:
        return {"operation": False, "error": str(e)}
