import { MongoClient } from "mongodb";
import { z } from "zod";

const client = new MongoClient("mongodb://localhost:27017");

const schema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
});

type Item = z.infer<typeof schema>;

await client.connect();

const db = client.db("try");
const collection = db.collection<Item>("items");

async function insert(data: Item): Promise<void> {
  const validData = schema.parse(data);

  await collection.insertOne(validData);
}

async function fetchData(id: string): Promise<Item | null> {
  const data = await collection.findOne({ id });

  if (data === null) {
    return null;
  }

  return schema.parse(data);
}

await insert({
  id: "myid483",
  name: "dev",
  active: true,
});

const item = await fetchData("myid483");

console.log(item);