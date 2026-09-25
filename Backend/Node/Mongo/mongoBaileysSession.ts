// ============================================================================
// mongoBaileysSession.ts
//
// One job: save / load / delete the Baileys LOGIN DATA ("auth state") in MongoDB.
// This is an adapter:
//
//   Baileys  <-->  this file  <-->  MongoDB
//
// What is stored: only the login (creds + encryption keys). NOT the live socket.
// With this saved, a user can reconnect later without scanning the QR again.
//
// Sections:
//   SECTION 1  readKeys / writeKeys  (used internally for the encryption keys)
//   SECTION 2  loadAuthState         (Baileys asks: "give me the login")
//   SECTION 3  saveCredentials       (Baileys says: "creds changed, save them")
//   SECTION 4  deleteAuthState       (logout -> remove everything of this user)
//   SECTION 5  hasAuthState          (does this user already have a saved login?)
// ============================================================================

import { BufferJSON, initAuthCreds, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from "@whiskeysockets/baileys";
import type { AnyBulkWriteOperation } from "mongodb";
import { baileysAuthCollection } from "./Mongodb_Client.ts";
import type { BaileysAuthDocument } from "./MongoTypes.ts";





// ============================================================================
// SECTION 1: READ / WRITE ENCRYPTION KEYS
// ============================================================================

// Baileys asks: "give me these keys of this type".
async function readKeys<T extends keyof SignalDataTypeMap>(accountId: string, dataType: T, dataKeys: string[]) {
  // One Mongo query for all the requested keys.
  const documents = await baileysAuthCollection.find({ accountId, dataType, dataKey: { $in: dataKeys } }).toArray();

  const result: { [key: string]: SignalDataTypeMap[T] } = {};

  // Every row holds its data as a JSON string -> convert it back (BufferJSON.reviver restores Buffers).
  for (const document of documents) {
    result[document.dataKey] = JSON.parse(document.storedValue, BufferJSON.reviver);
  }

  return result;
}


// Baileys says: "save these keys" (a null value means "delete this key").
async function writeKeys(accountId: string, data: { [T in keyof SignalDataTypeMap]?: { [key: string]: SignalDataTypeMap[T] | null } }) {
  // We collect all changes first, then send them to Mongo in ONE bulkWrite call.
  const operations: AnyBulkWriteOperation<BaileysAuthDocument>[] = [];

  for (const dataType of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
    const keyMap = data[dataType];
    if (!keyMap) continue;

    for (const dataKey of Object.keys(keyMap)) {
      const value = keyMap[dataKey];
      const filter = { accountId, dataType, dataKey };

      // null -> delete this row.
      if (value === null) {
        operations.push({ deleteOne: { filter } });
        continue;
      }

      // Otherwise -> update the row, or create it if it does not exist (upsert).
      const update = { $set: { storedValue: JSON.stringify(value, BufferJSON.replacer) } };

      operations.push({ updateOne: { filter, update, upsert: true } });
    }
  }

  if (operations.length > 0) {
    await baileysAuthCollection.bulkWrite(operations);
  }
}





// ============================================================================
// SECTION 2: LOAD AUTH STATE
// ============================================================================

// Called when a session starts. Returns the object Baileys needs: { creds, keys }.
export async function loadAuthState(accountId: string): Promise<AuthenticationState> {
  const credentialsDocument = await baileysAuthCollection.findOne({ accountId, dataType: "creds", dataKey: "creds" });

  // Saved creds found -> use them (no QR needed). Not found -> brand new empty creds (QR needed).
  const creds: AuthenticationCreds = credentialsDocument ? JSON.parse(credentialsDocument.storedValue, BufferJSON.reviver) : initAuthCreds();

  return {
    creds,
    keys: {
      get: (dataType, dataKeys) => readKeys(accountId, dataType, dataKeys),
      set: (data) => writeKeys(accountId, data),
    },
  };
}





// ============================================================================
// SECTION 3: SAVE CREDENTIALS
// ============================================================================

// Called every time the creds change (for example right after the QR is scanned).
export async function saveCredentials(accountId: string, creds: AuthenticationCreds) {
  const filter = { accountId, dataType: "creds", dataKey: "creds" };
  const update = { $set: { storedValue: JSON.stringify(creds, BufferJSON.replacer) } };

  await baileysAuthCollection.updateOne(filter, update, { upsert: true });
}





// ============================================================================
// SECTION 4: DELETE AUTH STATE
// ============================================================================

// Called on logout: removes creds AND all keys of this user.
export async function deleteAuthState(accountId: string) {
  await baileysAuthCollection.deleteMany({ accountId });
}





// ============================================================================
// SECTION 5: HAS AUTH STATE
// ============================================================================

// true -> this user already has a saved login row in Mongo.
export async function hasAuthState(accountId: string) {
  const document = await baileysAuthCollection.findOne({ accountId, dataType: "creds", dataKey: "creds" });

  return document !== null;
}
