from pgvector.sqlalchemy import Vector
from sqlalchemy import String, select, ForeignKey, Text, text
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from FastAPI_WebAuth.db.web_db import Base, DatabaseSchema
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
    wtAcc: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False, default="english")
    role_identity: Mapped[str] = mapped_column(Text)
    memory_Context: Mapped[str] = mapped_column(Text)
    rules_instructions: Mapped[str] = mapped_column(Text)
    response_Style: Mapped[str] = mapped_column(Text)
    task: Mapped[str] = mapped_column(Text)


class ChatMemories(Base):
    __tablename__ = "memory"
    id: Mapped[int] = mapped_column(primary_key=True)
    chatId: Mapped[str] = mapped_column(String, nullable=False)
    # custom_mode: Mapped[str] = mapped_column(Text)
    # custom_instructions: Mapped[str] = mapped_column(Text)         #######Later in updates
    # custom_memory: Mapped[str] = mapped_column(Text)
    sender_text: Mapped[str] = mapped_column(Text)
    contact_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)


async def init_app_db() -> None:
    async with engine.begin() as connection:
        await connection.execute(
            text('ALTER TABLE "usrWtAcc" ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT \'english\'')
        )
        await connection.execute(text('ALTER TABLE "usrWtAcc" ALTER COLUMN "wtAcc" DROP NOT NULL'))


async def UserWtsAcc_Write(
    email_: str,
    Language_: str,
    Role_identity_: str,
    Memory_Context_: str,
    Rules_instructions_: str,
    Response_Style_: str,
    Task_: str,
):
    async with Async_session() as Session:
        try:
            user_result = await Session.execute(
                select(DatabaseSchema).where(DatabaseSchema.email == email_)
            )
            user = user_result.scalar_one_or_none()
            if user is None:
                return False

            account_result = await Session.execute(
                select(UserWtsAccounts).where(UserWtsAccounts.email == email_)
            )
            account = account_result.scalar_one_or_none()
            if account is None:
                account = UserWtsAccounts(user_id=user.id, email=email_)
                Session.add(account)

            account.language = Language_
            account.role_identity = Role_identity_
            account.memory_Context = Memory_Context_
            account.rules_instructions = Rules_instructions_
            account.response_Style = Response_Style_
            account.task = Task_
            await Session.commit()
            return True
        except Exception:
            await Session.rollback()
            return False


async def ChatMemo_Write(
    chatId: str,
    Embedding: list[float],
    # Custom_mode: str = "Default",
    # Custom_instructions: str = "Default",
    # Custom_memory: str = "Default",
    Sender_text: str = "Default",
    Contact_text: str = "Default",
):
    async with Async_session() as Session:
        try:
            Users_chat_memo = ChatMemories(
                chatId=chatId,
                # custom_mode=Custom_mode,
                # custom_instructions=Custom_instructions,
                # custom_memory=Custom_memory,
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
    async with Async_session() as Session:
        Fetch_data = await Session.execute(
            select(UserWtsAccounts).where(UserWtsAccounts.email == email)
        )
        return Fetch_data.scalar_one_or_none()


async def REad_ChatMemo_Write(chatid: str):
    try:
        async with Async_session() as Session:
            fetch_data = await Session.execute(
                select(ChatMemories).where(ChatMemories.chatId == chatid)
            )
            return fetch_data.scalar_one_or_none()
    except Exception:
        return None
