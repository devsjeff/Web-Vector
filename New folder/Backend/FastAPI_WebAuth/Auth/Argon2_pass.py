from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from fastapi.concurrency import run_in_threadpool

ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)


async def hash_password(plain: str) -> str:
    return await run_in_threadpool(ph.hash, plain)


async def verify_password(hashed: str, plain: str) -> bool:
    try:
        return await run_in_threadpool(ph.verify, hashed, plain)
    except VerifyMismatchError:
        return False
    except (VerificationError, InvalidHashError):
        return False
    except Exception:
        return False
