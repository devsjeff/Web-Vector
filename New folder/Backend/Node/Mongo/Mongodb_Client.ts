// ============================================================================
// Mongodb_Client.ts
//
// One job: connect to MongoDB and export the "baileys_auth" collection.
//
// Mental picture:
//   MongoDB  ->  database "webvector"  ->  collection "baileys_auth"  ->  rows (documents)
// ============================================================================

import { MongoClient } from "mongodb";
import type { BaileysAuthDocument } from "./MongoTypes.ts";





// ============================================================================
// SECTION 1: SETTINGS
// ============================================================================

// Where MongoDB is running. Falls back to your local Docker Mongo if MONGO_URL is not set.
const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017";

// Database name.
const MONGO_DB = process.env.MONGO_DB ?? "webvector";





// ============================================================================
// SECTION 2: CONNECT
// ============================================================================

const mongoClient = new MongoClient(MONGO_URL);

// Top-level await: the file waits here until Mongo is really connected.
await mongoClient.connect();





// ============================================================================
// SECTION 3: THE COLLECTION (other files import this)
// ============================================================================

export const baileysAuthCollection = mongoClient.db(MONGO_DB).collection<BaileysAuthDocument>("baileys_auth");





// ============================================================================
// SECTION 4: INDEXES
// ============================================================================

// "1" only means "ascending order". The important part is the three fields together.
// unique: true -> Mongo refuses two rows with the same accountId + dataType + dataKey.
await baileysAuthCollection.createIndex({ accountId: 1, dataType: 1, dataKey: 1 }, { unique: true });

// Makes "find / delete everything of one account" fast.
await baileysAuthCollection.createIndex({ accountId: 1 });
