import type { WASocket } from "@whiskeysockets/baileys";
import { EventEmitter } from "node:events";

export type SessionState =
  | "connecting"
  | "qr"
  | "open"
  | "closed";

export interface ChatMessage {
  messageId: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

export interface MessageBatch {
  email: string;
  whatsappNumber: string;
  chatWithNumber: string;
  messages: ChatMessage[];
}

export interface WhatsAppSession {
  email: string;
  socket: WASocket;
  state: SessionState;
  qr: string | null;
  whatsappNumber: string | null;
  messagesByChat: Map<string, ChatMessage[]>;
  events: EventEmitter;
}