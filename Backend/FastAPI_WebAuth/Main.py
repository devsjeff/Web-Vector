from fastapi import FastAPI
from Routes.config import limiter

app = FastAPI()

app.state.limiter = limiter
