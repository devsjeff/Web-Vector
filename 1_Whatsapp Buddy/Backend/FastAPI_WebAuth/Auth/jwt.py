from datetime import datetime, timedelta, timezone
import os
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 *2    # 2 day


def create_access_token(user_id: str) -> str:
    try :
        now = datetime.now(timezone.utc)
        payload = {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    except Exception as e :
        return e


def Verify_decode_token(token: str) -> dict:
    """
    Raises:
        ExpiredSignatureError -> expired
        InvalidTokenError     -> bad signature / malformed
    """
    try :
        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub"]},
        )
    except Exception as e :
        return e