import { createRemoteStore } from "./remote-store";
import { initialEvents } from "./default-data";

export type EventItem = { title: string; date: string; owner: string; partner?: string; /** Connection trial (rehearsal) time, display text */ trialDate?: string; count: string; status: string; tone: string; webrtcLink: string };

const MAX_EVENTS = 200;

function isEventItem(value: unknown): value is EventItem {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return ["title", "date", "owner", "count", "status", "tone", "webrtcLink"].every((field) => typeof entry[field] === "string")
    && (entry.partner === undefined || typeof entry.partner === "string")
    && (entry.trialDate === undefined || typeof entry.trialDate === "string");
}

export function isEventList(value: unknown): value is EventItem[] {
  return Array.isArray(value) && value.length <= MAX_EVENTS && value.every(isEventItem);
}

const store = createRemoteStore("/api/store/events", initialEvents, isEventList);

export const getEventsSnapshot = store.getSnapshot;
export const getEventsServerSnapshot = store.getServerSnapshot;
export const subscribeEvents = store.subscribe;

export function updateEvents(change: (current: EventItem[]) => EventItem[]) {
  void store.set(change(getEventsSnapshot()));
}

export { initialEvents };

export const EVENT_STATUSES = [
  { tone: "live", label: "লাইভ" },
  { tone: "scheduled", label: "নির্ধারিত" },
  { tone: "draft", label: "খসড়া" },
  { tone: "done", label: "সম্পন্ন" },
] as const;

export function setEventStatus(title: string, tone: string) {
  const status = EVENT_STATUSES.find((item) => item.tone === tone);
  if (!status) return;
  updateEvents((current) => current.map((event) => event.title === title ? { ...event, tone: status.tone, status: status.label } : event));
}

// Public read-only view: events currently marked live, for the home and event boards
const EMPTY_EVENTS: EventItem[] = [];
const liveStore = createRemoteStore("/api/store/live", EMPTY_EVENTS, isEventList);

export const getLiveEventsSnapshot = liveStore.getSnapshot;
export const getLiveEventsServerSnapshot = liveStore.getServerSnapshot;
export const subscribeLiveEvents = liveStore.subscribe;

/** Replaces the event currently titled `originalTitle` (titles identify events). */
export function replaceEvent(originalTitle: string, next: EventItem) {
  updateEvents((current) => current.map((event) => event.title === originalTitle ? next : event));
}

export function deleteEvent(title: string) {
  updateEvents((current) => current.filter((event) => event.title !== title));
}
