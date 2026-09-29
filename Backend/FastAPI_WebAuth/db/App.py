from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    select,
    delete,
    desc,
)
from sqlalchemy.dialects.postgresql import JSONB, insert as pg_insert
from sqlalchemy.orm import Mapped, mapped_column

from FastAPI_WebAuth.db.web_db import AsyncSessionLocal, Base
from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.embeddings import cosine_similarity

Async_session = AsyncSessionLocal

FIELD_COLUMNS = ("language", "roleIdentity", "memoryContext", "rulesInstructions", "responseStyle")


class WhatsappConfig(Base):
    """
    Global default settings per user (email).
    When no contact-specific override is found, the assistant falls back to this configuration.
    """

    __tablename__ = "whatsapp_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    language: Mapped[dict] = mapped_column(JSONB, nullable=False)
    role_identity: Mapped[dict] = mapped_column(JSONB, nullable=False)
    memory_context: Mapped[dict] = mapped_column(JSONB, nullable=False)
    rules_instructions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    response_style: Mapped[dict] = mapped_column(JSONB, nullable=False)
    task: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self) -> dict:
        return {
            "language": self.language,
            "roleIdentity": self.role_identity,
            "memoryContext": self.memory_context,
            "rulesInstructions": self.rules_instructions,
            "responseStyle": self.response_style,
            "task": self.task,
        }


class ContactConfig(Base):
    """
    Per-contact custom persona and style settings.
    Allows unique tone (e.g. sarcastic, witty, playful roast), custom instructions,
    and behavior per WhatsApp phone number. If enabled=False or fields missing,
    assistant automatically falls back to global WhatsappConfig.
    """

    __tablename__ = "contact_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    whatsapp_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    tone_style: Mapped[str] = mapped_column(String(50), default="sarcastic", nullable=False)
    language: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    role_identity: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    memory_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rules_instructions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    response_style: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    task: Mapped[str] = mapped_column(Text, default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_contact_email_number", "email", "whatsapp_number", unique=True),
    )

    def to_dict(self) -> dict:
        return {
            "whatsappNumber": self.whatsapp_number,
            "contactName": self.contact_name or "",
            "enabled": self.enabled,
            "toneStyle": self.tone_style,
            "language": self.language,
            "roleIdentity": self.role_identity,
            "memoryContext": self.memory_context,
            "rulesInstructions": self.rules_instructions,
            "responseStyle": self.response_style,
            "task": self.task,
            "notes": self.notes,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class ContactChatStat(Base):
    """
    Tracks conversation statistics per contact:
    Number of chats/messages, last interaction, and contact identity.
    """

    __tablename__ = "contact_chat_stats"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    whatsapp_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chat_count: Mapped[int] = mapped_column(default=0, nullable=False)
    last_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_stat_email_number", "email", "whatsapp_number", unique=True),
    )

    def to_dict(self) -> dict:
        return {
            "whatsappNumber": self.whatsapp_number,
            "contactName": self.contact_name or "",
            "chatCount": self.chat_count,
            "lastMessage": self.last_message,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class ChatMemories(Base):
    """
    PgVector long-term memory store.
    Stores semantic vector embeddings (768-dim) partitioned by email and WhatsApp number.
    Allows exact semantic search across prior conversation turns and facts.
    """

    __tablename__ = "memory"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(100), index=True, nullable=False, default="")
    whatsapp_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False, default="")
    chatId: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    sender_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    contact_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    memory_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "whatsappNumber": self.whatsapp_number,
            "chatId": self.chatId,
            "senderText": self.sender_text,
            "contactText": self.contact_text,
            "memoryText": self.memory_text,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


# ============================================================================
# Global WhatsApp Config CRUD
# ============================================================================

async def Save_WhatsappConfig(user_id: int, email: str, config: dict) -> bool:
    values = {
        "user_id": user_id,
        "email": email,
        "language": config.get("language") or {"mode": "english", "customText": ""},
        "role_identity": config.get("roleIdentity") or {"mode": "personal", "customText": ""},
        "memory_context": config.get("memoryContext") or {"mode": "default", "customText": ""},
        "rules_instructions": config.get("rulesInstructions") or {"mode": "default", "customText": ""},
        "response_style": config.get("responseStyle") or {"mode": "default", "customText": ""},
        "task": config.get("task", ""),
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
    try:
        async with Async_session() as session:
            result = await session.execute(select(WhatsappConfig).where(WhatsappConfig.email == email))
            row = result.scalar_one_or_none()
            return row.to_dict() if row else None
    except Exception as e:
        print(f"[db] Read_WhatsappConfig failed: {e}")
        return None


# ============================================================================
# Contact Custom Persona CRUD (Per-number style, tone like sarcasm, rules)
# ============================================================================

async def Save_ContactConfig(user_id: int, email: str, whatsapp_number: str, config: dict) -> bool:
    clean_number = (whatsapp_number or "").strip()
    if not clean_number:
        return False

    values = {
        "user_id": user_id,
        "email": email,
        "whatsapp_number": clean_number,
        "contact_name": config.get("contactName") or None,
        "enabled": config.get("enabled", True),
        "tone_style": config.get("toneStyle", "sarcastic"),
        "language": config.get("language"),
        "role_identity": config.get("roleIdentity"),
        "memory_context": config.get("memoryContext"),
        "rules_instructions": config.get("rulesInstructions"),
        "response_style": config.get("responseStyle"),
        "task": config.get("task", ""),
        "notes": config.get("notes", ""),
    }
    update_values = {k: v for k, v in values.items() if k not in ("user_id", "email", "whatsapp_number")}
    update_values["updated_at"] = func.now()

    stmt = pg_insert(ContactConfig).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[ContactConfig.email, ContactConfig.whatsapp_number],
        set_=update_values,
    )

    async with Async_session() as session:
        try:
            await session.execute(stmt)
            await session.commit()
            return True
        except Exception as e:
            await session.rollback()
            print(f"[db] Save_ContactConfig failed: {e}")
            return False


async def Read_ContactConfig(email: str, whatsapp_number: str) -> dict | None:
    clean_number = (whatsapp_number or "").strip()
    if not clean_number:
        return None
    try:
        async with Async_session() as session:
            result = await session.execute(
                select(ContactConfig).where(
                    ContactConfig.email == email,
                    ContactConfig.whatsapp_number == clean_number,
                )
            )
            row = result.scalar_one_or_none()
            return row.to_dict() if row else None
    except Exception as e:
        print(f"[db] Read_ContactConfig failed: {e}")
        return None


async def List_ContactConfigs(email: str) -> list[dict]:
    try:
        async with Async_session() as session:
            result = await session.execute(
                select(ContactConfig).where(ContactConfig.email == email).order_by(desc(ContactConfig.updated_at))
            )
            return [row.to_dict() for row in result.scalars().all()]
    except Exception as e:
        print(f"[db] List_ContactConfigs failed: {e}")
        return []


async def Delete_ContactConfig(email: str, whatsapp_number: str) -> bool:
    clean_number = (whatsapp_number or "").strip()
    try:
        async with Async_session() as session:
            await session.execute(
                delete(ContactConfig).where(
                    ContactConfig.email == email,
                    ContactConfig.whatsapp_number == clean_number,
                )
            )
            await session.commit()
            return True
    except Exception as e:
        print(f"[db] Delete_ContactConfig failed: {e}")
        return False


# ============================================================================
# Contact Chat Statistics & Number Counter
# ============================================================================

async def Record_ContactMessage(email: str, whatsapp_number: str, contact_name: str | None = None, message_text: str = "") -> None:
    clean_number = (whatsapp_number or "").strip()
    if not clean_number:
        return

    clean_preview = (message_text or "").strip()[:200]

    stmt = pg_insert(ContactChatStat).values(
        email=email,
        whatsapp_number=clean_number,
        contact_name=contact_name,
        chat_count=1,
        last_message=clean_preview,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[ContactChatStat.email, ContactChatStat.whatsapp_number],
        set_={
            "chat_count": ContactChatStat.chat_count + 1,
            "last_message": clean_preview or ContactChatStat.last_message,
            "contact_name": contact_name or ContactChatStat.contact_name,
            "updated_at": func.now(),
        },
    )

    async with Async_session() as session:
        try:
            await session.execute(stmt)
            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"[db] Record_ContactMessage failed: {e}")


async def List_ContactsSummary(email: str) -> list[dict]:
    """
    Returns aggregated contacts for the frontend:
    Number, contact name, number of chats, number of saved pgvector memories,
    and whether custom settings are applied.
    """
    try:
        async with Async_session() as session:
            # 1. Fetch stats
            stats_res = await session.execute(
                select(ContactChatStat).where(ContactChatStat.email == email).order_by(desc(ContactChatStat.updated_at))
            )
            stats = {s.whatsapp_number: s for s in stats_res.scalars().all()}

            # 2. Fetch custom configs
            cfg_res = await session.execute(
                select(ContactConfig).where(ContactConfig.email == email)
            )
            configs = {c.whatsapp_number: c for c in cfg_res.scalars().all()}

            # 3. Fetch memory counts per number
            mem_counts_res = await session.execute(
                select(ChatMemories.whatsapp_number, func.count(ChatMemories.id))
                .where(ChatMemories.email == email)
                .group_by(ChatMemories.whatsapp_number)
            )
            mem_counts = dict(mem_counts_res.all())

            # Combine all numbers seen across stats, configs, and memories
            all_numbers = set(stats.keys()) | set(configs.keys()) | set(mem_counts.keys())

            results = []
            for num in all_numbers:
                stat = stats.get(num)
                cfg = configs.get(num)
                m_count = mem_counts.get(num, 0)

                contact_name = (cfg.contact_name if cfg and cfg.contact_name else None) or (stat.contact_name if stat else "") or ""
                chat_count = stat.chat_count if stat else 0
                last_msg = stat.last_message if stat else ""
                updated_at = (stat.updated_at if stat else (cfg.updated_at if cfg else None))

                results.append({
                    "whatsappNumber": num,
                    "contactName": contact_name,
                    "chatCount": chat_count,
                    "memoryCount": m_count,
                    "hasCustomConfig": bool(cfg and cfg.enabled),
                    "toneStyle": cfg.tone_style if cfg else "global",
                    "lastMessage": last_msg,
                    "updatedAt": updated_at.isoformat() if updated_at else None,
                })

            # Sort by chat count descending, then updated_at
            results.sort(key=lambda x: (x["chatCount"], x["updatedAt"] or ""), reverse=True)
            return results
    except Exception as e:
        print(f"[db] List_ContactsSummary failed: {e}")
        return []


# ============================================================================
# PgVector Memory Storage & Semantic Search
# ============================================================================

async def Save_ChatMemory(
    email: str,
    whatsapp_number: str,
    embedding: list[float],
    sender_text: str = "",
    contact_text: str = "",
    memory_text: str = "",
    chatId: str = "",
) -> bool:
    """Saves a conversation turn or extracted memory into pgvector."""
    clean_number = (whatsapp_number or "").strip()
    if not clean_number:
        clean_number = chatId.split("@")[0] if chatId else "default"

    summary = memory_text or (
        f"Contact: {sender_text} | Assistant: {contact_text}".strip()
    )

    async with Async_session() as session:
        try:
            mem = ChatMemories(
                email=email,
                whatsapp_number=clean_number,
                chatId=chatId or clean_number,
                sender_text=sender_text,
                contact_text=contact_text,
                memory_text=summary,
                embedding=embedding,
            )
            session.add(mem)
            await session.commit()
            return True
        except Exception as e:
            await session.rollback()
            print(f"[db] Save_ChatMemory failed: {e}")
            return False


async def Search_ChatMemories(
    email: str,
    whatsapp_number: str,
    query_embedding: list[float],
    limit: int = 5,
) -> list[dict]:
    """
    Retrieves the most semantically relevant memories for this contact
    using pgvector cosine distance order.
    """
    clean_number = (whatsapp_number or "").strip()
    try:
        async with Async_session() as session:
            # Check if vector extension is usable via cosine_distance
            try:
                stmt = (
                    select(ChatMemories)
                    .where(
                        ChatMemories.email == email,
                        ChatMemories.whatsapp_number == clean_number,
                    )
                    .order_by(ChatMemories.embedding.cosine_distance(query_embedding))
                    .limit(limit)
                )
                res = await session.execute(stmt)
                rows = res.scalars().all()
                return [r.to_dict() for r in rows]
            except Exception:
                # In-memory cosine similarity fallback if pgvector operator fails
                fallback_stmt = (
                    select(ChatMemories)
                    .where(
                        ChatMemories.email == email,
                        ChatMemories.whatsapp_number == clean_number,
                    )
                    .order_by(desc(ChatMemories.id))
                    .limit(50)
                )
                res = await session.execute(fallback_stmt)
                all_rows = res.scalars().all()
                scored = []
                for row in all_rows:
                    score = cosine_similarity(query_embedding, row.embedding)
                    scored.append((score, row))
                scored.sort(key=lambda x: x[0], reverse=True)
                return [r.to_dict() for _, r in scored[:limit]]
    except Exception as e:
        print(f"[db] Search_ChatMemories failed: {e}")
        return []


async def List_ChatMemories(email: str, whatsapp_number: str | None = None, limit: int = 50) -> list[dict]:
    """Lists saved pgvector memories for a contact or across the user's account."""
    try:
        async with Async_session() as session:
            stmt = select(ChatMemories).where(ChatMemories.email == email)
            if whatsapp_number:
                stmt = stmt.where(ChatMemories.whatsapp_number == whatsapp_number.strip())
            stmt = stmt.order_by(desc(ChatMemories.id)).limit(limit)

            res = await session.execute(stmt)
            return [r.to_dict() for r in res.scalars().all()]
    except Exception as e:
        print(f"[db] List_ChatMemories failed: {e}")
        return []


async def Delete_ChatMemory(memory_id: int, email: str) -> bool:
    try:
        async with Async_session() as session:
            await session.execute(
                delete(ChatMemories).where(
                    ChatMemories.id == memory_id,
                    ChatMemories.email == email,
                )
            )
            await session.commit()
            return True
    except Exception as e:
        print(f"[db] Delete_ChatMemory failed: {e}")
        return False


# Legacy compatibility functions
async def ChatMemo_Write(chatId: str, Embedding: list[float], Sender_text: str = "Default", Contact_text: str = "Default") -> bool:
    return await Save_ChatMemory(
        email="",
        whatsapp_number=chatId,
        embedding=Embedding,
        sender_text=Sender_text,
        contact_text=Contact_text,
        chatId=chatId,
    )


async def Read_ChatMemo(chatid: str) -> list[ChatMemories]:
    try:
        async with Async_session() as session:
            result = await session.execute(select(ChatMemories).where(ChatMemories.chatId == chatid))
            return list(result.scalars().all())
    except Exception:
        return []
