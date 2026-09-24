import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017";

const MONGO_DB = process.env.MONGO_DB ?? "webvector";

const mongoClient = new MongoClient(MONGO_URL);

await mongoClient.connect();

export const baileysAuthCollection = mongoClient.db(MONGO_DB).collection<{
    accountId: string;
    dataType: string;
    dataKey: string;
    storedValue: string;
  }>("baileys_auth");

await baileysAuthCollection.createIndex({accountId: 1,dataType: 1,dataKey: 1,},{unique: true});
await baileysAuthCollection.createIndex({accountId: 1});