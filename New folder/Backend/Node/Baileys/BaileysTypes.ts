// ============================================================================
// BaileysTypes.ts
//
// Only TYPES here (no logic). They describe the shape of our data.
//
//   WhatsAppSession
//   |-- email            who owns this WhatsApp
//   |-- socket           the live Baileys connection
//   |-- state            "connecting" | "qr" | "open" | "closed"
//   |-- qr               latest QR text (null when not needed)
//   |-- whatsappNumber   the number that scanned the QR
//   |-- messagesByChat   chatWithNumber -> messages waiting to be pushed
//   `-- events           small "radio" other files can listen to ("qr", "open", "close")
//
//   MessageBatch  = what we push out (Kafka) after 30 messages of one chat
// ============================================================================

import type { WASocket } from "@whiskeysockets/baileys";
import type { EventEmitter } from "node:events";





// ============================================================================
// SECTION 1: SESSION TYPES
// ============================================================================

// Where the connection is right now.
export type SessionState = "connecting" | "qr" | "open" | "closed";


// One WhatsApp message, in the small shape we keep.
export interface ChatMessage {
  messageId: string;
  fromMe: boolean; // true = you sent it, false = the other person sent it
  text: string;
  timestamp: number; // unix seconds
}


// One live WhatsApp session (lives in Node memory, NOT in Mongo).
export interface WhatsAppSession {
  email: string;
  socket: WASocket;
  state: SessionState;
  qr: string | null;
  whatsappNumber: string | null;
  messagesByChat: Map<string, ChatMessage[]>;
  events: EventEmitter;
}





// ============================================================================
// SECTION 2: BATCH TYPE (what goes to Kafka)
// ============================================================================

export interface MessageBatch {
  email: string; // which user (owner of the WhatsApp)
  whatsappNumber: string; // the user's own WhatsApp number
  chatWithNumber: string; // the other person's number
  messages: ChatMessage[]; // exactly 30 messages of this one chat
}





// ============================================================================
// SECTION 3: API RESPONSE TYPES (what BaileysApi.ts returns to Fastify)
// ============================================================================

// Answer to "give me a QR": either a QR text, or "already connected, no QR needed".
export type QrResult = { status: "connected" } | { status: "qr"; qr: string };


// Answer to "what is the WhatsApp status?" ("not_started" = no live session in memory).
export interface SessionStatus {
  state: SessionState | "not_started";
  whatsappNumber: string | null;
}
