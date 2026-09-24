import { MongoClient } from "mongodb";
import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";

const mongoClient = new MongoClient("mongodb://localhost:27017");
await mongoClient.connect();

const webvectorDatabase = mongoClient.db("webvector");
const baileysAuthCollection = webvectorDatabase.collection("baileys_auth");

// One document per (account + type + key). Prevents accidental duplicates.
await baileysAuthCollection.createIndex(
  { accountId: 1, dataType: 1, dataKey: 1 },
  { unique: true }
);

// Fast lookups + fast wipes when we only know the account.
await baileysAuthCollection.createIndex({ accountId: 1 });

async function readKeysOfType<T extends keyof SignalDataTypeMap>(accountId: string, dataType: T, dataKeys: string[]) {
  const matchingDocuments = await baileysAuthCollection.find({
    accountId,
    dataType,
    dataKey: { $in: dataKeys },
  }).toArray();

  const keyedResult: { [key: string]: SignalDataTypeMap[T] } = {};
  for (const document of matchingDocuments) {
    keyedResult[document.dataKey] = JSON.parse(document.storedValue, BufferJSON.reviver);
  }
  return keyedResult;
}

async function writeKeysOfAnyType(accountId: string, incomingData: { [T in keyof SignalDataTypeMap]?: { [key: string]: SignalDataTypeMap[T] | null } }) {
  const bulkOperations = [];

  for (const dataType of Object.keys(incomingData) as (keyof SignalDataTypeMap)[]) {
    const keyValueMap = incomingData[dataType];
    if (!keyValueMap) continue;

    for (const dataKey of Object.keys(keyValueMap)) {
      const valueToStore = keyValueMap[dataKey];

      if (valueToStore === null) {
        bulkOperations.push({ deleteOne: { filter: { accountId, dataType, dataKey } } });
      } else {
        bulkOperations.push({
          updateOne: {
            filter: { accountId, dataType, dataKey },
            update: { $set: { storedValue: JSON.stringify(valueToStore, BufferJSON.replacer) } },
            upsert: true,
          },
        });
      }
    }
  }

  if (bulkOperations.length > 0) await baileysAuthCollection.bulkWrite(bulkOperations);
}

export async function loadAuthStateForAccount(accountId: string): Promise<AuthenticationState> {
  const existingCredentialsDocument = await baileysAuthCollection.findOne({
    accountId,
    dataType: "creds",
    dataKey: "creds",
  });

  const credentialsForAccount: AuthenticationCreds = existingCredentialsDocument
    ? JSON.parse(existingCredentialsDocument.storedValue, BufferJSON.reviver)
    : initAuthCreds();

  return {
    creds: credentialsForAccount,
    keys: {
      get: (dataType, dataKeys) => readKeysOfType(accountId, dataType, dataKeys),
      set: (incomingData) => writeKeysOfAnyType(accountId, incomingData),
    },
  };
}

export async function saveCredentialsForAccount(accountId: string, credentials: AuthenticationCreds) {
  await baileysAuthCollection.updateOne(
    { accountId, dataType: "creds", dataKey: "creds" },
    { $set: { storedValue: JSON.stringify(credentials, BufferJSON.replacer) } },
    { upsert: true }
  );
}

export async function deleteAllAuthDataForAccount(accountId: string): Promise<number> {
  const deleteResult = await baileysAuthCollection.deleteMany({ accountId });
  return deleteResult.deletedCount;
}

export async function accountHasExistingSession(accountId: string): Promise<boolean> {
  const credentialsDocument = await baileysAuthCollection.findOne({ accountId, dataType: "creds", dataKey: "creds" });
  return credentialsDocument !== null;
}