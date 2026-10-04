import { createRemoteStore } from "./remote-store";

export type NoteEntry = { id: number; name: string; text: string };

const MAX_NOTES = 6;

function isNoteEntry(value: unknown): value is NoteEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "number" && typeof entry.name === "string" && typeof entry.text === "string";
}

export function isNoteList(value: unknown): value is NoteEntry[] {
  return Array.isArray(value) && value.length <= MAX_NOTES && value.every(isNoteEntry);
}

const EMPTY_NOTES: NoteEntry[] = [];
const store = createRemoteStore("/api/store/notes", EMPTY_NOTES, isNoteList);

export const getNotesSnapshot = store.getSnapshot;
export const getNotesServerSnapshot = store.getServerSnapshot;
export const subscribeNotes = store.subscribe;

export function publishNote(entry: NoteEntry) {
  const withoutExisting = getNotesSnapshot().filter((note) => note.id !== entry.id);
  void store.set([entry, ...withoutExisting].slice(0, MAX_NOTES));
}

export function deleteNote(id: number) {
  void store.set(getNotesSnapshot().filter((note) => note.id !== id));
}
