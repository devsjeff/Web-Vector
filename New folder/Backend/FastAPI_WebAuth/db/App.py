from pgvector.sqlalchemy import Vector
from sqlalchemy import String, select, ForeignKey, Text
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from FastAPI_WebAuth.db.web_db import Base
from FastAPI_WebAuth.Common_configs import DATABASE_URL

engine = create_async_engine(url=DATABASE_URL, echo=False)
Async_session = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)


class UserWtsAccounts(Base):
    __tablename__ = "usrWtAcc"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    wtAcc: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    role_identity: Mapped[str] = mapped_column(Text)
    memory_Context: Mapped[str] = mapped_column(Text)
    rules_instructions: Mapped[str] = mapped_column(Text)
    response_Style: Mapped[str] = mapped_column(Text)
    task: Mapped[str] = mapped_column(Text)


class ChatMemories(Base):
    __tablename__ = "memory"
    id: Mapped[int] = mapped_column(primary_key=True)
    chatId: Mapped[str] = mapped_column(String, nullable=False)
    custom_mode: Mapped[str] = mapped_column(Text)
    custom_instructions: Mapped[str] = mapped_column(Text)
    custom_memory: Mapped[str] = mapped_column(Text)
    sender_text: Mapped[str] = mapped_column(Text)
    contact_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)


async def UserWtsAcc_Write(
    user_id_: int,
    WtAcc_: str,
    email_: str,
    Role_identity_: str = "Default",
    Memory_Context_: str = "Default",
    Rules_instructions_: str = "Default",
    Response_Style_: str = "Default",
    Task_: str = "Default",
):
    async with Async_session() as Session:
        try:
            user_Wts_Acc_details = UserWtsAccounts(
                user_id=user_id_,
                wtAcc=WtAcc_,
                email=email_,
                role_identity=Role_identity_,
                memory_Context=Memory_Context_,
                rules_instructions=Rules_instructions_,
                response_Style=Response_Style_,
                task=Task_,
            )
            Session.add(user_Wts_Acc_details)
            await Session.commit()
            return True
        except Exception:
            await Session.rollback()
            return False


async def ChatMemo_Write(
    chatId: str,
    Embedding: list[float],
    Custom_mode: str = "Default",
    Custom_instructions: str = "Default",
    Custom_memory: str = "Default",
    Sender_text: str = "Default",
    Contact_text: str = "Default",
):
    async with Async_session() as Session:
        try:
            Users_chat_memo = ChatMemories(
                chatId=chatId,
                custom_mode=Custom_mode,
                custom_instructions=Custom_instructions,
                custom_memory=Custom_memory,
                sender_text=Sender_text,
                contact_text=Contact_text,
                embedding=Embedding,
            )
            Session.add(Users_chat_memo)
            await Session.commit()
            return True
        except Exception:
            await Session.rollback()
            return False


async def Read_UserWtsAcc(email: str):
    try:
        async with Async_session() as Session:
            Fetch_data = await Session.execute(
                select(UserWtsAccounts).where(UserWtsAccounts.email == email)
            )
            return Fetch_data.scalar_one_or_none()
    except Exception:
        return None


async def REad_ChatMemo_Write(chatid: str):
    try:
        async with Async_session() as Session:
            fetch_data = await Session.execute(
                select(ChatMemories).where(ChatMemories.chatId == chatid)
            )
            return fetch_data.scalar_one_or_none()
    except Exception:
        return None
