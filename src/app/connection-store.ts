// This browser's open meeting connection, kept in localStorage so the timer
// and disconnect button survive page reloads. The server holds the real record.

export type ActiveConnection = { id: string; eventTitle: string; office: string; joinedAt: number; link: string };

const STORAGE_KEY = "bccvc-active-connection";
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: ActiveConnection | null = null;

function isActiveConnection(value: unknown): value is ActiveConnection {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && typeof entry.eventTitle === "string" && typeof entry.office === "string" && typeof entry.joinedAt === "number" && typeof entry.link === "string";
}

export function getActiveConnection(): ActiveConnection | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    cachedValue = isActiveConnection(parsed) ? parsed : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export const getActiveConnectionServerSnapshot = (): ActiveConnection | null => null;

function setActiveConnection(value: ActiveConnection | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable - the timer just won't survive a reload
  }
  listeners.forEach((listener) => listener());
}

export function subscribeActiveConnection(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) onChange(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(onChange); window.removeEventListener("storage", onStorage); };
}

/** Records the join on the server. Returns an error message, or null on success. */
export async function startConnection(eventTitle: string, office: string, name: string, link: string): Promise<string | null> {
  try {
    const res = await fetch("/api/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventTitle, office, name }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return typeof data.error === "string" ? data.error : "সংযোগ সময় রেকর্ড করা যায়নি";
    setActiveConnection({ id: data.id, eventTitle, office, joinedAt: data.joinedAt, link });
    return null;
  } catch {
    return "সার্ভারের সাথে সংযোগ করা যায়নি";
  }
}

/** Records the disconnect. Returns the connection length in seconds, or null if it could not be saved. */
export async function endConnection(id: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/connections/${id}/leave`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    // 404: the record is gone, so there is nothing left to close
    if (!res.ok && res.status !== 404) return null;
    if (getActiveConnection()?.id === id) setActiveConnection(null);
    return typeof data.durationSec === "number" ? data.durationSec : 0;
  } catch {
    return null;
  }
}
