import os
from dotenv import load_dotenv

load_dotenv()

# Placeholders so the app can start without a filled .env.
# Replace these with real values in .env later.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://user:password@localhost:5432/webvector",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
GMAIL_EMAIL = os.getenv("EMAIL_ADDRESS", "your-email@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD", "your-app-password")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-to-a-long-random-secret")

# True in development (insecure cookies ok on localhost).
# Set DEV_MODE=false in production so Secure cookies are used.
dev = os.getenv("DEV_MODE", "true").lower() in ("1", "true", "yes")
