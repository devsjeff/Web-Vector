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
//   |-- chats            contact -> ChatState (recent messages + waiting messages)
//   |-- events           small "radio" other files can listen to ("qr", "open", "close")
//   `-- reconnectAttempts  how many times in a row we failed to reconnect
// ============================================================================

import type { WASocket } from "@whiskeysockets/baileys";
import type { EventEmitter } from "node:events";

// ============================================================================
// SECTION 1: SESSION TYPES
// ============================================================================

export type SessionState = "connecting" | "qr" | "open" | "closed";

// One WhatsApp message, in the small shape we keep (same shape travels over Kafka).
export interface ChatMessage {
  messageId: string;
  fromMe: boolean; // true = you (or the bot) sent it, false = the other person sent it
  text: string;
  timestamp: number; // unix seconds
}

// Everything we remember about ONE chat (one contact) while the server is running.
export interface ChatState {
  jid: string; // WhatsApp id we send replies to
  chatWithNumber: string; // the contact's number
  contactName: string | null;
  history: ChatMessage[]; // recent messages, both sides, oldest first
  pending: ChatMessage[]; // contact messages that are not answered yet (waiting for the "debounce" timer)
  timer: ReturnType<typeof setTimeout> | null;
  contactTimes: number[]; // when the contact wrote recently (for the "5 per minute" limit)
  flushFailures: number; // how many times publishing to Kafka failed in a row
  flushing: boolean; // true while a publish is in progress (so two publishes never overlap)
}

// The small part of a session that the message pipeline needs (so it can be tested without a real socket).
export interface PipelineSession {
  email: string;
  whatsappNumber: string | null;
  chats: Map<string, ChatState>;
}

// One live WhatsApp session (lives in Node memory, NOT in Mongo).
export interface WhatsAppSession extends PipelineSession {
  socket: WASocket;
  state: SessionState;
  qr: string | null;
  events: EventEmitter;
  reconnectAttempts: number;
}

// ============================================================================
// SECTION 2: API RESPONSE TYPES (what BaileysApi.ts returns to Fastify)
// ============================================================================

// Answer to "give me a QR": either a QR text, or "already connected, no QR needed".
export type QrResult = { status: "connected" } | { status: "qr"; qr: string };

// Answer to "what is the WhatsApp status?" ("not_started" = no live session in memory).
export interface SessionStatus {
  state: SessionState | "not_started";
  whatsappNumber: string | null;
}
