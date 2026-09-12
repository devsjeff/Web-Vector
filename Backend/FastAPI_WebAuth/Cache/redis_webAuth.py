from redis.asyncio import Redis
from FastAPI_WebAuth.Common_configs import REDIS_URL

redis = Redis.from_url(REDIS_URL , decode_responses=True )
