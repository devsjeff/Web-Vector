import os
from dotenv import load_dotenv

# Loads Backend/.env (python-dotenv walks up from this file's folder until it finds one).
load_dotenv()


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


# True in development (insecure cookies ok on localhost).
# Set DEV_MODE=false in production so Secure cookies are used.
dev = os.getenv("DEV_MODE", "true").lower() in ("1", "true", "yes")

# ---------------------------------------------------------------- Postgres / Redis
# Defaults match docker-compose.yml so `docker compose up -d` works with no .env at all.
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://webvector:webvector@localhost:5432/webvector")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ---------------------------------------------------------------- Mail
GMAIL_EMAIL = os.getenv("EMAIL_ADDRESS", "your-email@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD", "your-app-password")

# ---------------------------------------------------------------- JWT (Node verifies with the SAME secret)
_DEV_SECRET = "dev-only-secret-change-me-before-production-0123456789"
JWT_SECRET = os.getenv("JWT_SECRET", _DEV_SECRET)
if JWT_SECRET == _DEV_SECRET and not dev:
    raise RuntimeError("JWT_SECRET must be set when DEV_MODE=false")

# ---------------------------------------------------------------- Kafka (Node <-> Python bridge)
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
KAFKA_TOPIC_INCOMING = os.getenv("KAFKA_TOPIC_INCOMING", "whatsapp.incoming")  # Node  -> Python
KAFKA_TOPIC_OUTGOING = os.getenv("KAFKA_TOPIC_OUTGOING", "whatsapp.outgoing")  # Python -> Node
KAFKA_WORKER_GROUP_ID = os.getenv("KAFKA_WORKER_GROUP_ID", "web-vector-python-worker")
# Events older than this are dropped (protects against replaying an old backlog to real people).
EVENT_MAX_AGE_SECONDS = _int("EVENT_MAX_AGE_SECONDS", 900)

# ---------------------------------------------------------------- LLM (any OpenAI-compatible API)
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
LLM_MODEL = os.getenv("LLM_MODEL", "openrouter/free")
LLM_MAX_TOKENS = _int("LLM_MAX_TOKENS", 500)
LLM_TIMEOUT_SECONDS = _int("LLM_TIMEOUT_SECONDS", 60)
