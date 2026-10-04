import { createRemoteStore } from "./remote-store";
import { defaultWaitingList } from "./default-data";

export type WaitingEntry = { type: string; place: string; time: string };

function isWaitingEntry(value: unknown): value is WaitingEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.type === "string" && typeof entry.place === "string" && typeof entry.time === "string";
}

export function isWaitingList(value: unknown): value is WaitingEntry[] {
  return Array.isArray(value) && value.every(isWaitingEntry);
}

const store = createRemoteStore("/api/store/waiting", defaultWaitingList, isWaitingList);

export const getWaitingListSnapshot = store.getSnapshot;
export const getWaitingListServerSnapshot = store.getServerSnapshot;
export const subscribeWaitingList = store.subscribe;

export function publishWaitingList(items: WaitingEntry[]) {
  void store.set(items);
}

export { defaultWaitingList };
