from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.Routes.web.Web_routes import  WEBrouter


app = FastAPI()
app.include_router(WEBrouter)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded , _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware ,
    allow_origins=["http://localhost:3000"] ,
    allow_methods=["*"] ,
    allow_headers= ["*"]
)
