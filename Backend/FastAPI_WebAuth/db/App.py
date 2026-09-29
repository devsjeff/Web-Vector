from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import String, Text, ForeignKey, DateTime, func, select
from sqlalchemy.dialects.postgresql import JSONB, insert as pg_insert
from sqlalchemy.orm import mapped_column, Mapped

from FastAPI_WebAuth.db.web_db import Base, AsyncSessionLocal

# One DB engine for the whole app (it lives in web_db.py). Before, this file created a second
# engine + connection pool to the same database for no reason.
Async_session = AsyncSessionLocal

# The 5 "dropdown + custom text" settings from the dashboard, each stored as {"mode": ..., "customText": ...}.
FIELD_COLUMNS = ("language", "roleIdentity", "memoryContext", "rulesInstructions", "responseStyle")


class WhatsappConfig(Base):
    """
    One row per user = how that user's WhatsApp assistant should behave.
    Python's Kafka worker reads this row (by email) for every incoming WhatsApp message
    and turns it into the system prompt for the LLM.
    """

    __tablename__ = "whatsapp_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    language: Mapped[dict] = mapped_column(JSONB, nullable=False)
    role_identity: Mapped[dict] = mapped_column(JSONB, nullable=False)
    memory_context: Mapped[dict] = mapped_column(JSONB, nullable=False)
    rules_instructions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    response_style: Mapped[dict] = mapped_column(JSONB, nullable=False)
    task: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self) -> dict:
        """Same shape the dashboard (settings.tsx) sends and expects."""
        return {
            "language": self.language,
            "roleIdentity": self.role_identity,
            "memoryContext": self.memory_context,
            "rulesInstructions": self.rules_instructions,
            "responseStyle": self.response_style,
            "task": self.task,
        }


class ChatMemories(Base):
    """Per-chat vector memory (future feature - not used by the reply worker yet)."""

    __tablename__ = "memory"
    id: Mapped[int] = mapped_column(primary_key=True)
    chatId: Mapped[str] = mapped_column(String, nullable=False)
    sender_text: Mapped[str] = mapped_column(Text)
    contact_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)


async def Save_WhatsappConfig(user_id: int, email: str, config: dict) -> bool:
    """Create or update (upsert) this user's assistant settings. `config` is Configs_type.model_dump()."""
    values = {
        "user_id": user_id,
        "email": email,
        "language": config["language"],
        "role_identity": config["roleIdentity"],
        "memory_context": config["memoryContext"],
        "rules_instructions": config["rulesInstructions"],
        "response_style": config["responseStyle"],
        "task": config["task"],
    }
    update_values = {k: v for k, v in values.items() if k not in ("user_id", "email")}
    update_values["updated_at"] = func.now()

    stmt = pg_insert(WhatsappConfig).values(**values)
    stmt = stmt.on_conflict_do_update(index_elements=[WhatsappConfig.email], set_=update_values)

    async with Async_session() as session:
        try:
            await session.execute(stmt)
            await session.commit()
            return True
        except Exception as e:
            await session.rollback()
            print(f"[db] Save_WhatsappConfig failed: {e}")
            return False


async def Read_WhatsappConfig(email: str) -> dict | None:
    """Returns the saved settings as a plain dict, or None if this user never saved any (or DB error)."""
    try:
        async with Async_session() as session:
            result = await session.execute(select(WhatsappConfig).where(WhatsappConfig.email == email))
            row = result.scalar_one_or_none()
            return row.to_dict() if row else None
    except Exception as e:
        print(f"[db] Read_WhatsappConfig failed: {e}")
        return None


async def ChatMemo_Write(chatId: str, Embedding: list[float], Sender_text: str = "Default", Contact_text: str = "Default") -> bool:
    async with Async_session() as session:
        try:
            session.add(ChatMemories(chatId=chatId, sender_text=Sender_text, contact_text=Contact_text, embedding=Embedding))
            await session.commit()
            return True
        except Exception:
            await session.rollback()
            return False


async def Read_ChatMemo(chatid: str) -> list[ChatMemories]:
    try:
        async with Async_session() as session:
            result = await session.execute(select(ChatMemories).where(ChatMemories.chatId == chatid))
            return list(result.scalars().all())
    except Exception:
        return []
