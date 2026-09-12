from FastAPI_WebAuth.Common_configs import GMAIL_EMAIL , GMAIL_APP_PASSWORD
from FastAPI_WebAuth.Auth.otp import Generate_Otp
import aiosmtplib
from email.message import EmailMessage

async def Send_otp(email: str) -> dict:
    otp = Generate_Otp()
    message = EmailMessage()
    message["From"] = GMAIL_EMAIL
    message["To"] = email
    message["Subject"] = "Web-Vector Email Verification"
    message.set_content(f"WEB VECTOR \n\n\n Your OTP is: {otp} \n\n Expires in 5 minutes.")

    try:
        await aiosmtplib.send(
        message,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username=GMAIL_EMAIL,
        password=GMAIL_APP_PASSWORD)
        return {"operation_success": True, "otp": otp}
    except Exception as e:
        return {"operation_success": False, "error": str(e)}

if __name__ == "__main__":
    import asyncio
    result = asyncio.run(Send_otp(GMAIL_EMAIL))