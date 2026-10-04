import { toBn } from "./bn-utils";
import { createRemoteStore } from "./remote-store";

export type SupportMessage = { id: number; name: string; office: string; message: string; status: "open" | "resolved"; reply: string; submittedAt: number };

// How many of the newest messages the help center shows; older ones stay in MongoDB
export const MAX_SUPPORT_MESSAGES = 50;

function isSupportMessage(value: unknown): value is SupportMessage {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "number" && typeof entry.name === "string" && typeof entry.office === "string" && typeof entry.message === "string"
    && (entry.status === "open" || entry.status === "resolved") && typeof entry.reply === "string" && typeof entry.submittedAt === "number";
}

function isSupportList(value: unknown): value is SupportMessage[] {
  return Array.isArray(value) && value.every(isSupportMessage);
}

const SUPPORT_URL = "/api/support";
const EMPTY_MESSAGES: SupportMessage[] = [];
const store = createRemoteStore(SUPPORT_URL, EMPTY_MESSAGES, isSupportList);

export const getSupportSnapshot = store.getSnapshot;
export const getSupportServerSnapshot = store.getServerSnapshot;
export const subscribeSupportMessages = store.subscribe;

const jsonRequest = (method: string, body: unknown) => fetch(SUPPORT_URL, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Public submission - the server assigns the id and timestamp. */
export async function submitSupportMessage(name: string, office: string, message: string): Promise<boolean> {
  try {
    const ok = (await jsonRequest("POST", { name, office, message })).ok;
    if (ok) void store.refresh();
    return ok;
  } catch {
    return false;
  }
}

export function resolveSupportMessage(id: number, reply: string) {
  const next = getSupportSnapshot().map((msg) => msg.id === id ? { ...msg, status: "resolved" as const, reply } : msg);
  void store.mutate(next, () => jsonRequest("PATCH", { id, reply }));
}

export function formatSupportTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return toBn(`${hours}:${minutes}`);
}
