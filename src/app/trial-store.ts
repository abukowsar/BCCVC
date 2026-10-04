import { createRemoteStore } from "./remote-store";
import { defaultTrialSnapshot } from "./default-data";

export type PublishedTrialEntry = { name: string; audio: string; video: string };
export type PublishedTrialSnapshot = { scopeLabel: string; entries: PublishedTrialEntry[] };

function isPublishedTrialEntry(value: unknown): value is PublishedTrialEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.name === "string" && typeof entry.audio === "string" && typeof entry.video === "string";
}

export function isTrialSnapshot(value: unknown): value is PublishedTrialSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return typeof snapshot.scopeLabel === "string" && Array.isArray(snapshot.entries) && snapshot.entries.every(isPublishedTrialEntry);
}

const store = createRemoteStore("/api/store/trial", defaultTrialSnapshot, isTrialSnapshot);

export const getTrialSnapshot = store.getSnapshot;
export const getTrialServerSnapshot = store.getServerSnapshot;
export const subscribeTrialResults = store.subscribe;

export function publishTrialResults(snapshot: PublishedTrialSnapshot) {
  void store.set(snapshot);
}

export function describeTrialEntry(entry: PublishedTrialEntry): { detail: string; label: string; tone: "online" | "warning" } {
  if (entry.audio === "ok" && entry.video === "ok") return { detail: "অডিও ও ভিডিও প্রস্তুত · মিউট", label: "প্রস্তুত", tone: "online" };
  if (entry.video === "pending") return { detail: "ক্যামেরা পরীক্ষা চলছে", label: "পরীক্ষা চলছে", tone: "warning" };
  return { detail: "সংযোগে সমস্যা সনাক্ত হয়েছে", label: "সমস্যা", tone: "warning" };
}

export { defaultTrialSnapshot };

/** Admin's saved (not yet published) trial-board selection. Upazilas are "district|upazila" keys. */
export type TrialScope = { divisions: string[]; districts: string[]; upazilas: string[] };

export const EMPTY_TRIAL_SCOPE: TrialScope = { divisions: [], districts: [], upazilas: [] };

const isNameList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1000 && value.every((item) => typeof item === "string" && item.length <= 200);

export function isTrialScope(value: unknown): value is TrialScope {
  if (!value || typeof value !== "object") return false;
  const scope = value as Record<string, unknown>;
  return isNameList(scope.divisions) && isNameList(scope.districts) && isNameList(scope.upazilas);
}

const scopeStore = createRemoteStore("/api/store/trialScope", EMPTY_TRIAL_SCOPE, isTrialScope);

export const getTrialScopeSnapshot = scopeStore.getSnapshot;
export const getTrialScopeServerSnapshot = scopeStore.getServerSnapshot;
export const subscribeTrialScope = scopeStore.subscribe;
export const saveTrialScope = scopeStore.set;
