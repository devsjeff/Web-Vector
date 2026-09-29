from sqlalchemy import String, select, text
from sqlalchemy.orm import mapped_column, Mapped, DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from FastAPI_WebAuth.Common_configs import DATABASE_URL
from FastAPI_WebAuth.Auth.Argon2_pass import verify_password

engine = create_async_engine(url=DATABASE_URL, echo=False, pool_pre_ping=True)

AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class DatabaseSchema(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20), nullable=True)
    last_name: Mapped[str] = mapped_column(String(20), nullable=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)


async def init_db() -> None:
    """
    Run once at startup to create tables.

    The `memory` table has a pgvector column, which needs `CREATE EXTENSION vector`.
    Before, a missing extension made create_all fail for EVERY table (users too), and the
    error was swallowed in Main.py. Now: try to enable the extension, and if that is not
    possible, skip only the vector table so login/signup/config still work.
    """
    # Import here so every model is registered on Base before create_all (avoids a circular import).
    from FastAPI_WebAuth.db import App  # noqa: F401

    async with engine.begin() as conn:
        vector_ok = True
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception as e:
            vector_ok = False
            print(f"[startup] pgvector extension not available, skipping 'memory' table: {e}")

    async with engine.begin() as conn:
        tables = [t for t in Base.metadata.sorted_tables if vector_ok or t.name != "memory"]
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=tables))


async def check_user_exists(email: str) -> dict:
    """
    RETURNS: {"operation_success": True, "UserExist": bool}
             {"operation_success": False, "error": str}
    """
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(DatabaseSchema).where(DatabaseSchema.email == email))
            email_exist = result.scalar_one_or_none()

            if not email_exist:
                return {"operation_success": True, "UserExist": False}
            return {"operation_success": True, "UserExist": True}

        except SQLAlchemyError as e:
            return {"operation_success": False, "error": str(e)}


async def get_user_by_email(email: str) -> DatabaseSchema | None:
    """Returns the user row, or None if the user does not exist / the DB is down."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(DatabaseSchema).where(DatabaseSchema.email == email))
            return result.scalar_one_or_none()
    except Exception:
        return None


async def create_user_account(email: str, password: str, name: str | None = None, last_name: str | None = None) -> dict:
    """
    RETURNS: {"operation_success": True}
             {"operation_success": False, "error": str}
    """
    async with AsyncSessionLocal() as session:
        try:
            new_user = DatabaseSchema(email=email, password=password, name=name, last_name=last_name)
            session.add(new_user)
            await session.commit()
            return {"operation_success": True}

        except IntegrityError:
            await session.rollback()
            return {"operation_success": False, "error": "email_already_exists"}

        except SQLAlchemyError as e:
            await session.rollback()
            return {"operation_success": False, "error": str(e)}


async def Login_email_pass_Get(email: str, password: str) -> bool | None:
    """
    Returns True if email+password match,
    False if no match / user missing,
    None on server/DB error.
    """
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(DatabaseSchema).where(DatabaseSchema.email == email))
            user = result.scalar_one_or_none()
            if not user:
                return False
            return await verify_password(user.password, password)
    except Exception:
        return None


async def Update_user_account_pass(email: str, password: str) -> bool:
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(DatabaseSchema).where(DatabaseSchema.email == email))
            user = result.scalar_one_or_none()
            if user is None:
                return False
            user.password = password
            await session.commit()
            return True
        except Exception:
            await session.rollback()
            return False
