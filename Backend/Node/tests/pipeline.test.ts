// Unit tests for ChatPipeline (no Kafka, no WhatsApp, no database needed).
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { PipelineSession } from "../Baileys/BaileysTypes.ts";
import { addToHistory, getChat, onContactMessage, type PipelineOptions } from "../Baileys/ChatPipeline.ts";
import type { IncomingEvent } from "../Kafka/KafkaTypes.ts";

const fast: PipelineOptions = { historySize: 20, debounceMs: 40, contactRatePerMin: 5, retryDelayMs: 30, maxFlushRetries: 2 };
const session = (): PipelineSession => ({ email: "a@b.com", whatsappNumber: "918888888888", chats: new Map() });
const msg = (id: string, text: string, fromMe = false) => ({ messageId: id, fromMe, text, timestamp: 1000 });

test("3 quick messages become ONE event, with the older chat as history", async () => {
  const s = session();
  const chat = getChat(s, "919@s.whatsapp.net", "919", "Rahul");
  const events: IncomingEvent[] = [];
  const publish = async (e: IncomingEvent) => void events.push(e);

  addToHistory(chat, msg("old1", "hi"), fast);
  addToHistory(chat, msg("old2", "hello!", true), fast);
  onContactMessage(s, chat, msg("n1", "price?"), publish, fast);
  onContactMessage(s, chat, msg("n2", "and timing?"), publish, fast);
  onContactMessage(s, chat, msg("n3", "hello??"), publish, fast);
  await sleep(150);

  assert.equal(events.length, 1);
  assert.equal(events[0].message.text, "price?\nand timing?\nhello??");
  assert.equal(events[0].message.messageId, "n3");
  assert.deepEqual(events[0].history.map((m) => m.messageId), ["old1", "old2"]);
  assert.equal(events[0].email, "a@b.com");
  assert.equal(events[0].whatsappNumber, "918888888888");
  assert.equal(events[0].contactName, "Rahul");
  assert.equal(events[0].chatJid, "919@s.whatsapp.net");
  assert.equal(chat.pending.length, 0);
});

test("history is capped at the last 20 messages", async () => {
  const s = session();
  const chat = getChat(s, "1@s.whatsapp.net", "1", null);
  const events: IncomingEvent[] = [];
  for (let i = 0; i < 50; i++) addToHistory(chat, msg(`h${i}`, `m${i}`), fast);
  onContactMessage(s, chat, msg("now", "latest"), async (e) => void events.push(e), fast);
  await sleep(120);

  assert.equal(events[0].history.length, 20);
  assert.equal(events[0].history[19].messageId, "h49");
});

test("the same message delivered twice is answered once", async () => {
  const s = session();
  const chat = getChat(s, "1@s.whatsapp.net", "1", null);
  const events: IncomingEvent[] = [];
  const publish = async (e: IncomingEvent) => void events.push(e);

  assert.equal(onContactMessage(s, chat, msg("same", "hey"), publish, fast), "queued");
  assert.equal(onContactMessage(s, chat, msg("same", "hey"), publish, fast), "duplicate");
  await sleep(120);
  assert.equal(events.length, 1);
});

test("more than 5 messages per minute from one contact are ignored", async () => {
  const s = session();
  const chat = getChat(s, "1@s.whatsapp.net", "1", null);
  const results: string[] = [];
  for (let i = 0; i < 8; i++) results.push(onContactMessage(s, chat, msg(`m${i}`, "spam"), async () => {}, fast, 5000));
  assert.deepEqual(results, ["queued", "queued", "queued", "queued", "queued", "rate_limited", "rate_limited", "rate_limited"]);

  // a minute later the contact may write again
  assert.equal(onContactMessage(s, chat, msg("later", "hi"), async () => {}, fast, 5000 + 61_000), "queued");
});

test("Kafka down: retried, then delivered when it comes back", async () => {
  const s = session();
  const chat = getChat(s, "1@s.whatsapp.net", "1", null);
  const events: IncomingEvent[] = [];
  let calls = 0;
  const flaky = async (e: IncomingEvent) => {
    if (++calls < 3) throw new Error("kafka down");
    events.push(e);
  };
  onContactMessage(s, chat, msg("m1", "hi"), flaky, fast);
  await sleep(300);
  assert.equal(calls, 3);
  assert.equal(events.length, 1);
  assert.equal(chat.pending.length, 0);
});

test("Kafka down for good: gives up after the retry limit instead of looping forever", async () => {
  const s = session();
  const chat = getChat(s, "1@s.whatsapp.net", "1", null);
  let calls = 0;
  onContactMessage(s, chat, msg("m1", "hi"), async () => { calls++; throw new Error("down"); }, fast);
  await sleep(400);
  assert.equal(calls, 3); // first try + 2 retries
  assert.equal(chat.pending.length, 0);
});

test("a message that arrives while publishing is answered in the next round", async () => {
  const s = session();
  const chat = getChat(s, "1@s.whatsapp.net", "1", null);
  const events: IncomingEvent[] = [];
  const slow = async (e: IncomingEvent) => { await sleep(60); events.push(e); };
  onContactMessage(s, chat, msg("a", "first"), slow, fast);
  await sleep(60); // flush started, publish in progress
  onContactMessage(s, chat, msg("b", "second"), slow, fast);
  await sleep(300);
  assert.deepEqual(events.map((e) => e.message.text), ["first", "second"]);
  assert.deepEqual(events[1].history.map((m) => m.messageId), ["a"]);
});
