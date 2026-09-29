// ============================================================================
// KafkaTypes.ts - the exact JSON that travels between Node and Python.
//
//   Node   --(topic whatsapp.incoming)-->  Python : IncomingEvent  "a contact wrote, here is the chat"
//   Python --(topic whatsapp.outgoing)-->  Node   : OutgoingEvent  "send this reply to that contact"
//
// Python has the same shapes in FastAPI_WebAuth/Kafka/events.py. Change one -> change both.
// ============================================================================

export interface WireMessage {
  messageId: string;
  fromMe: boolean; // true = the account owner (or this bot) wrote it, false = the contact wrote it
  text: string;
  timestamp: number; // unix seconds
}

export interface IncomingEvent {
  eventId: string;
  createdAt: number; // unix milliseconds
  email: string; // owner of the WhatsApp (Python uses it to load this user's settings from Postgres)
  whatsappNumber: string; // owner's own number
  chatJid: string; // WhatsApp id of the chat, Python sends it back so Node knows where to reply
  chatWithNumber: string; // the contact's number
  contactName: string | null;
  history: WireMessage[]; // up to HISTORY_SIZE (20) older messages, oldest first
  message: WireMessage; // the newest message from the contact
}

export interface OutgoingEvent {
  eventId: string;
  createdAt: number;
  email: string;
  chatJid: string;
  chatWithNumber: string;
  reply: string;
  inReplyTo: string;
}

// Messages from Kafka are just bytes. Check the shape before trusting them.
export function isOutgoingEvent(value: unknown): value is OutgoingEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;

  return (
    typeof event.eventId === "string" &&
    typeof event.createdAt === "number" &&
    typeof event.email === "string" &&
    typeof event.chatJid === "string" &&
    typeof event.reply === "string" &&
    event.reply.trim() !== ""
  );
}
