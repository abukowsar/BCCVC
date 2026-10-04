import "server-only";
import { MongoClient, type Db } from "mongodb";
import { COLLECTIONS, ensureSchema, type ListCollectionName } from "./db-schema";

const globalForMongo = globalThis as typeof globalThis & { bccvcMongoClient?: Promise<MongoClient>; bccvcSchemaReady?: Promise<unknown> };

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in .env.local");
  // Reuse one connection across hot reloads in dev and across requests in production
  if (!globalForMongo.bccvcMongoClient) {
    globalForMongo.bccvcMongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 }).connect().catch((error) => {
      globalForMongo.bccvcMongoClient = undefined;
      throw error;
    });
  }
  return globalForMongo.bccvcMongoClient;
}

export async function getDb(): Promise<Db> {
  const db = (await getClient()).db(process.env.MONGODB_DB || "bccvc");
  // Create any missing collections and indexes once per server process
  globalForMongo.bccvcSchemaReady ??= ensureSchema(db).catch((error) => {
    globalForMongo.bccvcSchemaReady = undefined;
    throw error;
  });
  await globalForMongo.bccvcSchemaReady;
  return db;
}

/** Reads an ordered list collection, without MongoDB bookkeeping fields. */
export async function readList<T>(name: ListCollectionName): Promise<T[]> {
  const docs = await (await getDb()).collection(name).find({}, { projection: { _id: 0, position: 0, updatedAt: 0 } }).sort({ position: 1 }).toArray();
  return docs as unknown as T[];
}

/** Replaces the whole contents of an ordered list collection in one round trip. */
export async function writeList(name: ListCollectionName, items: object[]): Promise<void> {
  const now = new Date();
  const inserts = items.map((item, position) => {
    // Never let client data choose the document id
    const fields: Record<string, unknown> = { ...item };
    delete fields._id;
    return { insertOne: { document: { ...fields, position, updatedAt: now } } };
  });
  await (await getDb()).collection(name).bulkWrite([{ deleteMany: { filter: {} } }, ...inserts], { ordered: true });
}

type SettingDoc = { _id: string; updatedAt: Date; [field: string]: unknown };

export async function getSettings() {
  return (await getDb()).collection<SettingDoc>(COLLECTIONS.settings);
}
