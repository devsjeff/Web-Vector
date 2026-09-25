// ============================================================================
// MongoTypes.ts
//
// The shape of the data we store inside MongoDB.
// (Session / message types are NOT here. They live in Baileys/BaileysTypes.ts)
// ============================================================================





// One row inside the "baileys_auth" collection.
// Every piece of Baileys login data (creds, pre-keys, session keys...) is saved as one row like this.
export interface BaileysAuthDocument {
  accountId: string; // whose WhatsApp this belongs to (we use the user's email)
  dataType: string; // kind of data: "creds", "pre-key", "session", ...
  dataKey: string; // id inside that kind: "creds", "1", "2", ...
  storedValue: string; // the data itself, converted to a JSON string
}
