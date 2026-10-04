import { getSession } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/db-schema";
import { getSettings, readList, writeList } from "@/lib/mongodb";
import { defaultTrialSnapshot } from "../../../default-data";
import { isEventList, type EventItem } from "../../../events-store";
import { isNoteList } from "../../../note-store";
import { EMPTY_TRIAL_SCOPE, isTrialScope, isTrialSnapshot, type PublishedTrialEntry, type PublishedTrialSnapshot, type TrialScope } from "../../../trial-store";
import { isWaitingList } from "../../../waiting-store";
import { isWebrtcLink } from "../../../webrtc-store";

type StoreHandler = {
  validate: (value: unknown) => boolean;
  publicRead: boolean;
  read: () => Promise<unknown>;
  /** Omitted for read-only views */
  write?: (value: never) => Promise<void>;
};

// Each admin-writable value maps to its own MongoDB collection; public ones are shown on the public and event boards
const stores: Record<string, StoreHandler> = {
  events: {
    validate: isEventList,
    publicRead: false,
    read: () => readList(COLLECTIONS.events),
    write: (value: object[]) => writeList(COLLECTIONS.events, value),
  },
  live: {
    validate: () => false,
    publicRead: true,
    read: async () => (await readList<EventItem>(COLLECTIONS.events)).filter((event) => event.tone === "live"),
  },
  waiting: {
    validate: isWaitingList,
    publicRead: true,
    read: () => readList(COLLECTIONS.waitingList),
    write: (value: object[]) => writeList(COLLECTIONS.waitingList, value),
  },
  notes: {
    validate: isNoteList,
    publicRead: true,
    read: () => readList(COLLECTIONS.notes),
    write: (value: object[]) => writeList(COLLECTIONS.notes, value),
  },
  trial: {
    validate: isTrialSnapshot,
    publicRead: true,
    read: async (): Promise<PublishedTrialSnapshot> => {
      const [setting, entries] = await Promise.all([(await getSettings()).findOne({ _id: "trial" }), readList<PublishedTrialEntry>(COLLECTIONS.trialResults)]);
      return { scopeLabel: typeof setting?.scopeLabel === "string" ? setting.scopeLabel : defaultTrialSnapshot.scopeLabel, entries };
    },
    write: async (value: PublishedTrialSnapshot) => {
      await writeList(COLLECTIONS.trialResults, value.entries);
      await (await getSettings()).updateOne({ _id: "trial" }, { $set: { scopeLabel: value.scopeLabel, updatedAt: new Date() } }, { upsert: true });
    },
  },
  trialScope: {
    validate: isTrialScope,
    publicRead: false,
    read: async (): Promise<TrialScope> => {
      const setting = await (await getSettings()).findOne({ _id: "trial_scope" });
      return isTrialScope(setting?.value) ? setting.value : EMPTY_TRIAL_SCOPE;
    },
    write: async (value: TrialScope) => {
      await (await getSettings()).updateOne({ _id: "trial_scope" }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
    },
  },
  webrtc: {
    validate: isWebrtcLink,
    publicRead: true,
    read: async () => {
      const setting = await (await getSettings()).findOne({ _id: "webrtc" });
      return typeof setting?.value === "string" ? setting.value : "";
    },
    write: async (value: string) => {
      await (await getSettings()).updateOne({ _id: "webrtc" }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
    },
  },
};

const MAX_BODY_BYTES = 100_000;

export async function GET(_request: Request, ctx: RouteContext<"/api/store/[key]">) {
  const { key } = await ctx.params;
  const store = stores[key];
  if (!store) return Response.json({ error: "Unknown store" }, { status: 404 });
  if (!store.publicRead && !(await getSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ value: await store.read() });
  } catch (error) {
    console.error(`GET /api/store/${key} failed`, error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request, ctx: RouteContext<"/api/store/[key]">) {
  const { key } = await ctx.params;
  const store = stores[key];
  if (!store) return Response.json({ error: "Unknown store" }, { status: 404 });
  if (!store.write) return Response.json({ error: "Read-only" }, { status: 405 });
  if (!(await getSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 });
  let value: unknown;
  try {
    value = (JSON.parse(raw) as { value?: unknown }).value;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!store.validate(value)) return Response.json({ error: "Invalid value" }, { status: 400 });

  try {
    await store.write!(value as never);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`PUT /api/store/${key} failed`, error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
