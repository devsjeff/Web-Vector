import os 
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError ("Database url is missing")


REDIS_URL  = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise RuntimeError ("Redis url is missing")

GMAIL_EMAIL = os.getenv("GMAIL_EMAIL")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")


if not GMAIL_EMAIL or (not GMAIL_APP_PASSWORD) :
    raise RuntimeError ("Gmail password or email missing")