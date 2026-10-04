// Client-side cache for a value kept in MongoDB behind /api routes.
// Works with useSyncExternalStore: polls while something is subscribed and
// applies writes optimistically so the UI updates immediately.

const POLL_MS = 5000;

export type RemoteStore<T> = {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  subscribe: (onStoreChange: () => void) => () => void;
  refresh: () => Promise<void>;
  /** Optimistically sets `next`, then runs `request`; re-syncs from the server if it fails. */
  mutate: (next: T, request: () => Promise<Response>) => Promise<boolean>;
  /** Optimistically sets `next` and PUTs it to the store URL. */
  set: (next: T) => Promise<boolean>;
};

export function createRemoteStore<T>(url: string, fallback: T, isValid: (value: unknown) => value is T): RemoteStore<T> {
  let snapshot = fallback;
  let serialized = JSON.stringify(fallback);
  let writeVersion = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  const apply = (next: T) => {
    const nextSerialized = JSON.stringify(next);
    if (nextSerialized === serialized) return;
    snapshot = next;
    serialized = nextSerialized;
    listeners.forEach((listener) => listener());
  };

  const refresh = async () => {
    const versionAtStart = writeVersion;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { value?: unknown };
      // A local write happened while this request was in flight; its result is newer
      if (versionAtStart !== writeVersion) return;
      apply(data.value == null ? fallback : isValid(data.value) ? data.value : fallback);
    } catch {
      // Network error - keep showing the last known value
    }
  };

  const mutate = async (next: T, request: () => Promise<Response>) => {
    writeVersion += 1;
    apply(next);
    let ok = false;
    try {
      ok = (await request()).ok;
    } catch {
      ok = false;
    }
    if (!ok) console.error(`Saving to ${url} failed`);
    await refresh();
    return ok;
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => fallback,
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      if (listeners.size === 1) {
        void refresh();
        timer = setInterval(() => void refresh(), POLL_MS);
      }
      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    refresh,
    mutate,
    set: (next) => mutate(next, () => fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: next }) })),
  };
}
