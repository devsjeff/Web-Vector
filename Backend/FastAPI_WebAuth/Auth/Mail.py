from FastAPI_WebAuth.Common_configs import EMAIL_ADDRESS ,EMAIL_APP_PASSWORD
from Types_pydantic import Email
import aiosmtplib
from email.message import Message

Port:int = 587

async def Send_otp(email:Email , otp):
    message = Message()
    
    message["From"]= EMAIL_ADDRESS
    message["To"] = email
    message["Subject"] = " Web-Vector  Email Verification"
    
    message.set_content(f"""
    Your Web Vector verification code is:
                    {otp}
    This code will expire in 5 minutes.
    If you did not request this, you can ignore this email.
    """)
    await aiosmtplib.send(
        message
        
        
    )