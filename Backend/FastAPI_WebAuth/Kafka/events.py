"""
events.py - the exact JSON that travels between Node and Python over Kafka.

  Node   --(topic whatsapp.incoming)-->  Python   : IncomingEvent
  Python --(topic whatsapp.outgoing)-->  Node     : OutgoingEvent

On the wire the JSON keys are camelCase (Node style). In Python they are snake_case.
The alias generator converts between the two, so neither side has to think about it.
"""
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


class _Wire(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
        str_strip_whitespace=True,
    )


class ChatMessage(_Wire):
    message_id: str = Field(min_length=1)
    from_me: bool
    text: str = ""
    timestamp: int = 0  # unix seconds

    @field_validator("timestamp", mode="before")
    @classmethod
    def _coerce_timestamp(cls, v: Any) -> int:
        if v is None or v == "":
            return 0
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0

    @field_validator("from_me", mode="before")
    @classmethod
    def _coerce_from_me(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes")
        return bool(v)

    @field_validator("message_id", mode="before")
    @classmethod
    def _coerce_message_id(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)


class IncomingEvent(_Wire):
    event_id: str = Field(min_length=1)
    created_at: int  # unix milliseconds
    email: str = Field(min_length=1)
    whatsapp_number: str = ""
    chat_jid: str = Field(min_length=1)
    chat_with_number: str = ""
    contact_name: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)
    message: ChatMessage

    @field_validator("created_at", mode="before")
    @classmethod
    def _coerce_created_at(cls, v: Any) -> int:
        if v is None or v == "":
            return 0
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0

    @field_validator("contact_name", mode="before")
    @classmethod
    def _empty_contact_name_to_none(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("history", mode="before")
    @classmethod
    def _history_none_to_list(cls, v: Any) -> list:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        return v


class OutgoingEvent(_Wire):
    event_id: str = Field(min_length=1)
    created_at: int
    email: str = Field(min_length=1)
    chat_jid: str = Field(min_length=1)
    chat_with_number: str = ""
    reply: str = Field(min_length=1)
    in_reply_to: str = ""

    @field_validator("created_at", mode="before")
    @classmethod
    def _coerce_created_at(cls, v: Any) -> int:
        if v is None or v == "":
            return 0
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0
