// Needs MongoDB running (docker compose up -d mongodb).   npm test
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { initAuthCreds } from "@whiskeysockets/baileys";
import { closeMongo } from "../Mongo/Mongodb_Client.ts";
import { deleteAuthState, hasAuthState, listLinkedAccounts, loadAuthState, saveCredentials } from "../Mongo/mongoBaileysSession.ts";

const email = `mongo-test-${Date.now()}@example.com`;
const other = `mongo-test-other-${Date.now()}@example.com`;
after(async () => {
  await deleteAuthState(email);
  await deleteAuthState(other);
  await closeMongo();
});

test("creds + keys survive a save/load round trip (Buffers stay Buffers)", async () => {
  const first = await loadAuthState(email);
  assert.equal(await hasAuthState(email), false);

  await saveCredentials(email, first.creds);
  assert.equal(await hasAuthState(email), true);

  await first.keys.set({ "pre-key": { "1": { private: Buffer.from("secret"), public: Buffer.from("pub") } }, session: { "abc.0": Buffer.from("session-bytes") } });

  const second = await loadAuthState(email);
  assert.deepEqual(second.creds.noiseKey.private, first.creds.noiseKey.private); // same login as before
  assert.ok(Buffer.isBuffer(second.creds.noiseKey.private));

  const preKeys = await second.keys.get("pre-key", ["1", "missing"]);
  assert.equal(Buffer.from(preKeys["1"].private).toString(), "secret");
  assert.equal(preKeys["missing"], undefined);
  const sessionKeys = await second.keys.get("session", ["abc.0"]);
  assert.equal(Buffer.from(sessionKeys["abc.0"]).toString(), "session-bytes");
});

test("a null value deletes a key", async () => {
  const state = await loadAuthState(email);
  await state.keys.set({ "pre-key": { "1": null as never } });
  assert.equal((await state.keys.get("pre-key", ["1"]))["1"], undefined);
});

test("users are isolated, and delete only removes ONE user's data", async () => {
  const a = await loadAuthState(email);
  const b = await loadAuthState(other);
  await saveCredentials(email, a.creds);
  await saveCredentials(other, b.creds);
  await b.keys.set({ session: { "x.0": Buffer.from("b-only") } });

  await deleteAuthState(email);
  assert.equal(await hasAuthState(email), false);
  assert.equal(await hasAuthState(other), true);
  assert.equal(Buffer.from((await (await loadAuthState(other)).keys.get("session", ["x.0"]))["x.0"]).toString(), "b-only");
});

test("only really linked accounts (creds.me) are restored on startup", async () => {
  const unlinked = initAuthCreds();
  await saveCredentials(other, unlinked);
  assert.ok(!(await listLinkedAccounts()).includes(other)); // unfinished QR attempt

  const linked = initAuthCreds();
  linked.me = { id: "918888888888:1@s.whatsapp.net", name: "Test" };
  await saveCredentials(other, linked);
  assert.ok((await listLinkedAccounts()).includes(other));
});
