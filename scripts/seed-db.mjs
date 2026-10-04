// Creates the MongoDB collections and indexes the app uses and fills new collections
// with starting data. Safe to re-run: existing collections and their data are never changed.
// (The app runs the same setup automatically the first time it connects.)
//
//   npm run db:seed
//
// Reads MONGODB_URI and MONGODB_DB from .env.local (or the environment).

import { MongoClient } from "mongodb";
import { COLLECTIONS, ensureSchema } from "../src/lib/db-schema.ts";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "bccvc";
if (!uri) {
  console.error("MONGODB_URI is not set. Add it to .env.local.");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to database "${dbName}"`);

  const report = await ensureSchema(db);
  for (const name of Object.values(COLLECTIONS)) {
    const count = await db.collection(name).countDocuments();
    const status = report.created.includes(name) ? `created${report.seeded[name] ? `, ${report.seeded[name]} starting documents` : ""}` : "already existed, left unchanged";
    console.log(`  ${name.padEnd(17)} ${String(count).padStart(4)} documents  (${status})`);
  }

  // Data from the older single-collection layout is not migrated automatically
  if ((await db.listCollections({ name: "kv" }, { nameOnly: true }).toArray()).length > 0) {
    console.log('  Note: an old "kv" collection exists from an earlier version; it is no longer used.');
  }
  console.log("Done.");
} catch (error) {
  console.error("Seeding failed:", error.message);
  if (/SSL|alert number 80|ENOTFOUND|timed out|Server selection/i.test(error.message)) {
    console.error("If this is MongoDB Atlas, add this computer's IP under Network Access and try again.");
  }
  process.exitCode = 1;
} finally {
  await client.close();
}
