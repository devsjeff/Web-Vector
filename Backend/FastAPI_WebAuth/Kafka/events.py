"""
events.py - the exact JSON that travels between Node and Python over Kafka.

  Node   --(topic whatsapp.incoming)-->  Python   : IncomingEvent  "a contact wrote something, here is the chat"
  Python --(topic whatsapp.outgoing)-->  Node     : OutgoingEvent  "send this reply to that contact"

On the wire the JSON keys are camelCase (Node style). In Python they are snake_case.
The alias generator converts between the two, so neither side has to think about it.
"""
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class ChatMessage(_Wire):
    message_id: str
    from_me: bool  # True = the account owner (or this bot) wrote it, False = the contact wrote it
    text: str
    timestamp: int = 0  # unix seconds


class IncomingEvent(_Wire):
    event_id: str
    created_at: int  # unix milliseconds, when Node created the event
    email: str  # which user (owner of the WhatsApp) - also the key to find their settings in Postgres
    whatsapp_number: str  # owner's own WhatsApp number
    chat_jid: str  # WhatsApp id of the chat, Node needs this to send the reply to the right place
    chat_with_number: str  # the contact's number
    contact_name: str | None = None
    history: list[ChatMessage] = []  # up to 20 older messages, oldest first
    message: ChatMessage  # the newest message from the contact


class OutgoingEvent(_Wire):
    event_id: str
    created_at: int
    email: str
    chat_jid: str
    chat_with_number: str
    reply: str
    in_reply_to: str  # message_id of the contact's message we are answering
