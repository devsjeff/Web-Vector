from FastAPI_WebAuth.Common_configs import EMAIL_ADDRESS ,EMAIL_APP_PASSWORD
from Types_pydantic import Email
import aiosmtplib
from email.message import Message

async def Send_otp(email:Email):
    message = Message()
    
    message[]