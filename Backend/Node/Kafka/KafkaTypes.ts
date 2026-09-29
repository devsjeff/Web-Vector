// ============================================================================
// KafkaTypes.ts - the exact JSON that travels between Node and Python.
//
//   Node   --(topic whatsapp.incoming)-->  Python : IncomingEvent
//   Python --(topic whatsapp.outgoing)-->  Node   : OutgoingEvent
//
// Python has the same shapes in FastAPI_WebAuth/Kafka/events.py. Change one -> change both.
// ============================================================================

export interface WireMessage {
  messageId: string;
  fromMe: boolean;
  text: string;
  timestamp: number; // unix seconds
}

export interface IncomingEvent {
  eventId: string;
  createdAt: number; // unix milliseconds
  email: string;
  whatsappNumber: string;
  chatJid: string;
  chatWithNumber: string;
  contactName: string | null;
  history: WireMessage[];
  message: WireMessage;
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

export function isOutgoingEvent(value: unknown): value is OutgoingEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;

  return (
    typeof event.eventId === "string" &&
    event.eventId.length > 0 &&
    typeof event.createdAt === "number" &&
    Number.isFinite(event.createdAt) &&
    typeof event.email === "string" &&
    event.email.length > 0 &&
    typeof event.chatJid === "string" &&
    event.chatJid.length > 0 &&
    typeof event.chatWithNumber === "string" &&
    typeof event.reply === "string" &&
    event.reply.trim() !== "" &&
    typeof event.inReplyTo === "string"
  );
}
