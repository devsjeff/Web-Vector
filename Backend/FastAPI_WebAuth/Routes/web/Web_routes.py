from fastapi import  Request ,APIRouter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from Auth.Types_pydantic import Email

from Auth.Types_pydantic import Token , LoginType ,SignupType

from config import limiter

router  = APIRouter()

@router.get("/Auth/SignupOTP")
@limiter.limit("3/min")
async def Home (email:Email):
    
     