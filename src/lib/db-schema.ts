// MongoDB collections, indexes and starting data. Used by the app on first connect
// and by scripts/seed-db.mjs, so it must not import server-only or app runtime code.
import type { Db, IndexDescription } from "mongodb";
import { defaultTrialSnapshot, defaultWaitingList, initialEvents } from "../app/default-data.ts";
import { defaultOfficeLists } from "../app/gov-offices.ts";

export const COLLECTIONS = {
  users: "users",
  offices: "offices",
  events: "events",
  supportMessages: "support_messages",
  waitingList: "waiting_list",
  trialResults: "trial_results",
  notes: "notes",
  settings: "settings",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Ordered lists replaced as a whole by the admin panel; `position` keeps their order. */
export const LIST_COLLECTIONS = [COLLECTIONS.events, COLLECTIONS.waitingList, COLLECTIONS.trialResults, COLLECTIONS.notes] as const;
export type ListCollectionName = (typeof LIST_COLLECTIONS)[number];

const INDEXES: Record<CollectionName, IndexDescription[]> = {
  users: [{ key: { username: 1 }, unique: true }],
  offices: [{ key: { category: 1, name: 1 }, unique: true }, { key: { category: 1, order: 1 } }],
  events: [{ key: { position: 1 } }],
  support_messages: [{ key: { id: 1 }, unique: true }, { key: { submittedAt: -1 } }, { key: { status: 1 } }],
  waiting_list: [{ key: { position: 1 } }],
  trial_results: [{ key: { position: 1 } }],
  notes: [{ key: { position: 1 } }],
  settings: [],
};

function startingDocuments(name: CollectionName, now: Date): Record<string, unknown>[] {
  const positioned = (items: object[]) => items.map((item, position) => ({ ...item, position, updatedAt: now }));
  switch (name) {
    case "offices": {
      const byCategory = { ministry: defaultOfficeLists.ministries, division: defaultOfficeLists.divisions, agency: defaultOfficeLists.agencies, partner: defaultOfficeLists.partners };
      return Object.entries(byCategory).flatMap(([category, names]) => names.map((officeName, order) => ({ category, name: officeName, order, active: true, createdAt: now })));
    }
    case "events": return positioned(initialEvents);
    case "waiting_list": return positioned(defaultWaitingList);
    case "trial_results": return positioned(defaultTrialSnapshot.entries);
    case "settings": return [{ _id: "trial", scopeLabel: defaultTrialSnapshot.scopeLabel, updatedAt: now }, { _id: "webrtc", value: "", updatedAt: now }];
    default: return [];
  }
}

export type SchemaReport = { created: CollectionName[]; seeded: Partial<Record<CollectionName, number>> };

/**
 * Creates missing collections with their indexes and fills newly created ones with
 * starting data. Never touches collections that already exist, apart from adding indexes.
 */
export async function ensureSchema(db: Db): Promise<SchemaReport> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name));
  const report: SchemaReport = { created: [], seeded: {} };
  const now = new Date();
  for (const name of Object.values(COLLECTIONS)) {
    if (!existing.has(name)) {
      await db.createCollection(name).catch((error: { codeName?: string }) => {
        // Another server process created it at the same moment
        if (error.codeName !== "NamespaceExists") throw error;
      });
      report.created.push(name);
      const docs = startingDocuments(name, now);
      if (docs.length > 0) {
        await db.collection(name).insertMany(docs as never[]);
        report.seeded[name] = docs.length;
      }
    }
    if (INDEXES[name].length > 0) await db.collection(name).createIndexes(INDEXES[name]);
  }
  return report;
}
