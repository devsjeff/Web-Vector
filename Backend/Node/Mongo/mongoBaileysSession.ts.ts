import { BufferJSON, initAuthCreds, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from "@whiskeysockets/baileys";
import { baileysAuthCollection } from "./Mongodb_Client";

async function readKeys<T extends keyof SignalDataTypeMap>(accountId: string, dataType: T, dataKeys: string[]) {
  const documents = await baileysAuthCollection.find({ accountId, dataType, dataKey: { $in: dataKeys } }).toArray();

  const result: { [key: string]: SignalDataTypeMap[T] } = {};

  for (const document of documents) {
    result[document.dataKey] = JSON.parse(document.storedValue, BufferJSON.reviver);
  }

  return result;
}

async function writeKeys(accountId: string, data: { [T in keyof SignalDataTypeMap]?: { [key: string]: SignalDataTypeMap[T] | null } }) {
  const operations = [];

  for (const dataType of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
    const keyMap = data[dataType];
    if (!keyMap) continue;

    for (const dataKey of Object.keys(keyMap)) {
      const value = keyMap[dataKey];

      if (value === null) {
        operations.push({ deleteOne: { filter: { accountId, dataType, dataKey } } });
        continue;
      }

      operations.push({ updateOne: { filter: { accountId, dataType, dataKey }, 
        update: { $set: { storedValue: JSON.stringify(value, BufferJSON.replacer) } }, upsert: true } });
    }
  }

  if (operations.length > 0) {
    await baileysAuthCollection.bulkWrite(operations);
  }
}

export async function loadAuthState(accountId: string): Promise<AuthenticationState> {
  const credentialsDocument = await baileysAuthCollection.findOne({ accountId, dataType: "creds", dataKey: "creds" });

  const creds: AuthenticationCreds = credentialsDocument ? JSON.parse(credentialsDocument.storedValue, BufferJSON.reviver) : initAuthCreds();

  return {
    creds,
    keys: {
      get: (dataType, dataKeys) => readKeys(accountId, dataType, dataKeys),
      set: (data) => writeKeys(accountId, data),
    },
  };
}

export async function saveCredentials(accountId: string, creds: AuthenticationCreds) {
  await baileysAuthCollection.updateOne({ accountId, dataType: "creds", dataKey: "creds" }, 
    { $set: { storedValue: JSON.stringify(creds, BufferJSON.replacer) } }, { upsert: true });
}

export async function deleteAuthState(accountId: string) {
  await baileysAuthCollection.deleteMany({ accountId });
}

export async function hasAuthState(accountId: string) {
  const document = await baileysAuthCollection.findOne({ accountId, dataType: "creds", dataKey: "creds" });

  return document !== null;
}