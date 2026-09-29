from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.Routes.web.Web_routes import WEBrouter
from FastAPI_WebAuth.Routes.app_routes.Whatsapp_configs import APP_ROUTER

from FastAPI_WebAuth.db.web_db import init_db
from FastAPI_WebAuth.db.App import init_app_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_app_db()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(WEBrouter)
app.include_router(APP_ROUTER)
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,  # type: ignore[arg-type]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
