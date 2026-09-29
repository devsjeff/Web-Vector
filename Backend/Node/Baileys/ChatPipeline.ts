// ============================================================================
// ChatPipeline.ts
//
// The "brain" between WhatsApp and Kafka. No sockets in here, so it is easy to test.
//
//   contact message
//     -> remember it in the chat history                 (addToHistory)
//     -> wait REPLY_DEBOUNCE_MS for more messages        (so 3 quick texts get ONE reply, not three)
//     -> publish {history (last 20) + newest message}    (flush -> Kafka -> Python -> AI)
//
// Protection built in:
//   - same message twice (WhatsApp sometimes delivers twice)   -> ignored
//   - a contact writing more than 5 messages per minute        -> ignored (stops spam loops / cost)
//   - Kafka down                                               -> retried a few times, then dropped
// ============================================================================

import { randomUUID } from "node:crypto";
import { env } from "../CommonENV.ts";
import type { IncomingEvent } from "../Kafka/KafkaTypes.ts";
import type { ChatMessage, ChatState, PipelineSession } from "./BaileysTypes.ts";

export type PublishFn = (event: IncomingEvent) => Promise<void>;

export interface PipelineOptions {
  historySize: number;
  debounceMs: number;
  contactRatePerMin: number;
  retryDelayMs: number;
  maxFlushRetries: number;
}

export const defaultOptions: PipelineOptions = {
  historySize: env.HISTORY_SIZE,
  debounceMs: env.REPLY_DEBOUNCE_MS,
  contactRatePerMin: env.CONTACT_RATE_LIMIT_PER_MIN,
  retryDelayMs: 5_000,
  maxFlushRetries: 3,
};

const MAX_CHATS_IN_MEMORY = 500;

// ============================================================================
// SECTION 1: CHATS + HISTORY
// ============================================================================

export function getChat(session: PipelineSession, jid: string, chatWithNumber: string, contactName: string | null): ChatState {
  let chat = session.chats.get(jid);

  if (!chat) {
    if (session.chats.size >= MAX_CHATS_IN_MEMORY) evictIdleChat(session);

    chat = { jid, chatWithNumber, contactName: null, history: [], pending: [], timer: null, contactTimes: [], flushFailures: 0, flushing: false };
    session.chats.set(jid, chat);
  }

  if (contactName) chat.contactName = contactName;

  return chat;
}

// Memory guard: forget one chat that has nothing waiting.
function evictIdleChat(session: PipelineSession) {
  for (const [jid, chat] of session.chats) {
    if (chat.pending.length === 0 && !chat.timer) {
      session.chats.delete(jid);
      return;
    }
  }
}

// Returns false if we already have this message (duplicate delivery).
export function addToHistory(chat: ChatState, message: ChatMessage, options: PipelineOptions = defaultOptions): boolean {
  if (chat.history.some((old) => old.messageId === message.messageId)) return false;

  chat.history.push(message);

  const maxKept = options.historySize * 3;
  if (chat.history.length > maxKept) chat.history.splice(0, chat.history.length - maxKept);

  return true;
}

// ============================================================================
// SECTION 2: NEW MESSAGE FROM THE CONTACT
// ============================================================================

export function onContactMessage(session: PipelineSession, chat: ChatState, message: ChatMessage, publish: PublishFn, options: PipelineOptions = defaultOptions, now = Date.now()): "queued" | "duplicate" | "rate_limited" {
  if (!addToHistory(chat, message, options)) return "duplicate";

  // Keep only the last 60 seconds of timestamps, then check the limit.
  chat.contactTimes = chat.contactTimes.filter((time) => now - time < 60_000);
  if (chat.contactTimes.length >= options.contactRatePerMin) return "rate_limited";
  chat.contactTimes.push(now);

  chat.pending.push(message);
  schedule(session, chat, publish, options, options.debounceMs);

  return "queued";
}

function schedule(session: PipelineSession, chat: ChatState, publish: PublishFn, options: PipelineOptions, delayMs: number) {
  if (chat.timer) clearTimeout(chat.timer);

  chat.timer = setTimeout(() => {
    void flush(session, chat, publish, options);
  }, delayMs);
}

// ============================================================================
// SECTION 3: PUBLISH (history + newest message -> Kafka)
// ============================================================================

async function flush(session: PipelineSession, chat: ChatState, publish: PublishFn, options: PipelineOptions) {
  chat.timer = null;

  if (chat.pending.length === 0) return;

  // A publish is already running. When it finishes it schedules the next round for whatever is still waiting.
  // (Without this guard, the same message could be sent to the AI twice -> the contact gets a double reply.)
  if (chat.flushing) return;

  // Our own number is only known after the connection opened. Try again a bit later.
  if (!session.whatsappNumber) return schedule(session, chat, publish, options, options.retryDelayMs);

  const waiting = [...chat.pending];
  const waitingIds = new Set(waiting.map((message) => message.messageId));
  const newest = waiting[waiting.length - 1];

  // History = older messages of this chat, without the ones we are answering now.
  const history = chat.history.filter((message) => !waitingIds.has(message.messageId)).slice(-options.historySize);

  const event: IncomingEvent = {
    eventId: randomUUID(),
    createdAt: Date.now(),
    email: session.email,
    whatsappNumber: session.whatsappNumber,
    chatJid: chat.jid,
    chatWithNumber: chat.chatWithNumber,
    contactName: chat.contactName,
    history,
    message: { messageId: newest.messageId, fromMe: false, text: waiting.map((message) => message.text).join("\n"), timestamp: newest.timestamp },
  };

  chat.flushing = true;

  try {
    await publish(event);

    chat.pending = chat.pending.filter((message) => !waitingIds.has(message.messageId));
    chat.flushFailures = 0;
  } catch (error) {
    chat.flushFailures += 1;
    console.error(`[${session.email}] could not publish to Kafka (try ${chat.flushFailures}):`, (error as Error).message);

    if (chat.flushFailures <= options.maxFlushRetries) return schedule(session, chat, publish, options, options.retryDelayMs);

    // Give up on these messages instead of retrying forever.
    chat.pending = chat.pending.filter((message) => !waitingIds.has(message.messageId));
    chat.flushFailures = 0;
  } finally {
    chat.flushing = false;
  }

  // Messages that arrived while we were publishing are still waiting -> the next round.
  if (chat.pending.length > 0 && !chat.timer) schedule(session, chat, publish, options, options.debounceMs);
}

// Stops every waiting timer of a session (logout / shutdown).
export function clearChatTimers(session: PipelineSession) {
  for (const chat of session.chats.values()) {
    if (chat.timer) clearTimeout(chat.timer);
    chat.timer = null;
  }
}
