from sqlalchemy import String, select
from sqlalchemy.orm import mapped_column, Mapped, DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker,AsyncSession
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from FastAPI_WebAuth.Common_configs import DATABASE_URL


# ================= ENGINE & SESSION =================

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(bind=engine,class_=AsyncSession,expire_on_commit=False)

class Base(DeclarativeBase):
    pass


class DatabaseSchema(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20), nullable=True)
    last_name: Mapped[str] = mapped_column(String(20), nullable=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)


# ================= INIT DB =================

async def init_db() -> None:
    """Run once at startup to create tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def check_user_exists(email: str):
    """
    RETURNS: {"operation_success": True, "UserExist": bool}
             {"operation_success": False, "error": str}
    """
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(DatabaseSchema).where(DatabaseSchema.email == email)
            )
            email_exist = result.scalar_one_or_none()

            if not email_exist:
                return {"operation_success": True, "UserExist": False}
            return {"operation_success": True, "UserExist": True}

        except SQLAlchemyError as e:
            return {"operation_success": False, "error": str(e)}


async def create_user_account(email: str, password: str):
    """
    RETURNS: {"operation_success": True}
             {"operation_success": False, "error": str}
    """
    async with AsyncSessionLocal() as session:
        try:
            new_user = DatabaseSchema(email=email,password=password)
            session.add(new_user)
            await session.commit()
            return {"operation_success": True}

        except IntegrityError:
            await session.rollback()
            return {"operation_success": False, "error": "email_already_exists"}

        except SQLAlchemyError as e:
            await session.rollback()
            return {"operation_success": False, "error": str(e)}