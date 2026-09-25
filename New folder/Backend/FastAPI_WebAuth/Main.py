from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.Routes.web.Web_routes import WEBrouter
from FastAPI_WebAuth.db.web_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as e:
        # Don't crash startup if DB is not ready yet; log and continue
        print(f"[startup] init_db skipped/failed: {e}")
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(WEBrouter)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
