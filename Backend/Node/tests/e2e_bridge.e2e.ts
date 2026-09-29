// ============================================================================
// END-TO-END test of the whole loop (only the WhatsApp socket is fake):
//
//   fake WhatsApp message -> Node (ChatPipeline) -> Kafka -> Python worker -> Postgres settings -> LLM
//   -> Kafka -> Node (sendReply) -> socket.sendMessage(...)
//
// Needs running:  postgres, kafka  +  the Python worker  +  an OpenAI-compatible LLM (tests/fake_llm.py works)
// Run it with the helper:   bash Backend/tests/run_e2e.sh
// ============================================================================
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { WAMessage } from "@whiskeysockets/baileys";
import type { WhatsAppSession } from "../Baileys/BaileysTypes.ts";
import { __setSessionForTests, closeAllSessions, handleIncomingMessages, sendReply } from "../Baileys/CreateSession.ts";
import { startKafka, stopKafka } from "../Kafka/baileys_kafka.ts";

const EMAIL = process.env.E2E_EMAIL ?? "";
const LLM_URL = process.env.E2E_LLM_URL ?? "http://127.0.0.1:9911";
const sent: { jid: string; text: string }[] = [];

function fakeSession(): WhatsAppSession {
  const socket = {
    user: { id: "918888888888:5@s.whatsapp.net" },
    sendMessage: async (jid: string, content: { text: string }) => {
      sent.push({ jid, text: content.text });
      return { key: { id: `SENT-${sent.length}` } };
    },
    end() {},
  };
  return { email: EMAIL, socket: socket as never, state: "open", qr: null, whatsappNumber: "918888888888", chats: new Map(), events: new EventEmitter(), reconnectAttempts: 0 };
}

const incoming = (id: string, text: string, jid = "919999999999@s.whatsapp.net", ageSeconds = 0): WAMessage =>
  ({ key: { id, remoteJid: jid, fromMe: false }, pushName: "Rahul", messageTimestamp: Math.floor(Date.now() / 1000) - ageSeconds, message: { conversation: text } }) as WAMessage;

async function waitFor(condition: () => boolean, ms = 40_000) {
  const end = Date.now() + ms;
  while (!condition() && Date.now() < end) await sleep(200);
}

let session: WhatsAppSession;
before(async () => {
  assert.ok(EMAIL, "set E2E_EMAIL (a user that saved assistant settings)");
  session = fakeSession();
  __setSessionForTests(session);
  await startKafka(sendReply);
  await sleep(3000); // let the consumer group finish joining
});
after(async () => {
  closeAllSessions();
  await stopKafka();
});

test("a WhatsApp message gets an AI reply, built from the settings saved in Postgres", async () => {
  await handleIncomingMessages(session, [incoming("A1", "how much is a haircut?")], "notify");
  await waitFor(() => sent.length >= 1);

  assert.equal(sent.length, 1, "no reply was sent to WhatsApp");
  assert.equal(sent[0].jid, "919999999999@s.whatsapp.net");
  assert.equal(sent[0].text, "[fake-llm] how much is a haircut?");

  const requests = (await (await fetch(`${LLM_URL}/_requests`)).json()) as { messages: { role: string; content: string }[] }[];
  const system = requests.at(-1)!.messages[0].content;
  assert.match(system, /Booking assistant for Glow Salon/); // role      (Postgres)
  assert.match(system, /Book haircut appointments/); //         task      (Postgres)
  assert.match(system, /Never offer discounts/); //             rules     (Postgres)
  assert.match(system, /Hinglish/); //                          language  (Postgres)
  assert.match(system, /sarcasm/); //                           style     (Postgres)
  assert.match(system, /Rahul/); //                             contact name from WhatsApp
});

test("the second question carries the earlier conversation (incl. the bot's own reply)", async () => {
  await handleIncomingMessages(session, [incoming("A2", "and a beard trim?")], "notify");
  await waitFor(() => sent.length >= 2);
  assert.equal(sent.length, 2);

  const requests = (await (await fetch(`${LLM_URL}/_requests`)).json()) as { messages: { role: string; content: string }[] }[];
  const turns = requests.at(-1)!.messages.slice(1).map((m) => `${m.role}: ${m.content}`);
  assert.deepEqual(turns, ["user: how much is a haircut?", "assistant: [fake-llm] how much is a haircut?", "user: and a beard trim?"]);
});

test("two quick messages get ONE combined reply (not two)", async () => {
  const before = sent.length;
  await handleIncomingMessages(session, [incoming("B1", "hi"), incoming("B2", "are you open on sunday?")], "notify");
  await waitFor(() => sent.length > before);
  await sleep(4000); // make sure no second reply sneaks in
  assert.equal(sent.length, before + 1);
  assert.match(sent.at(-1)!.text, /hi\nare you open on sunday\?/);
});

test("old backlog messages, groups and own-number chat are never answered", async () => {
  const before = sent.length;
  await handleIncomingMessages(session, [incoming("C1", "very old", "919999999999@s.whatsapp.net", 3600)], "notify"); // 1h old
  await handleIncomingMessages(session, [incoming("C2", "group hello", "12345-678@g.us")], "notify");
  await handleIncomingMessages(session, [incoming("C3", "note to self", "918888888888@s.whatsapp.net")], "notify");
  await handleIncomingMessages(session, [incoming("C4", "history sync", "919999999999@s.whatsapp.net")], "append");
  await sleep(6000);
  assert.equal(sent.length, before);
});

test("a different contact has a separate history (no leaking between chats)", async () => {
  const before = sent.length;
  await handleIncomingMessages(session, [incoming("D1", "hello from priya", "917777777777@s.whatsapp.net")], "notify");
  await waitFor(() => sent.length > before);
  assert.equal(sent.at(-1)!.jid, "917777777777@s.whatsapp.net");

  const requests = (await (await fetch(`${LLM_URL}/_requests`)).json()) as { messages: { role: string; content: string }[] }[];
  const turns = requests.at(-1)!.messages.slice(1);
  assert.deepEqual(turns.map((m) => m.content), ["hello from priya"]); // nothing from Rahul's chat
});

test("sendReply refuses group ids and users without an open session", async () => {
  const event = { eventId: "x", createdAt: Date.now(), email: EMAIL, chatJid: "12345-678@g.us", chatWithNumber: "1", reply: "hi", inReplyTo: "m" };
  await assert.rejects(() => sendReply(event), /refusing to send/);
  await assert.rejects(() => sendReply({ ...event, email: "nobody@example.com", chatJid: "1@s.whatsapp.net" }), /no open WhatsApp session/);
});
