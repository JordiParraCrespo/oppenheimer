/**
 * Which of the Inbox's items the reader has opened, kept on this device, so
 * the list marks the rest unread as a mail client does. Keyed by the item's
 * occurrence (`29-inbox.md` §3), so a new wait on the same session comes
 * back unread. A convenience of this browser: storage switched off or
 * cleared reads everything as unread, nothing more. Kept outside React so
 * the list and the reading pane read one store.
 */
const STORAGE_KEY = 'oppenheimer.inbox.read';

/** The most recent keys kept; an occurrence older than these has long left the Inbox. */
const KEPT = 500;

function load(): readonly string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((key) => typeof key === 'string') : [];
  } catch {
    // Storage switched off, or something from an older shape: nothing read yet.
    return [];
  }
}

let read: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function current(): ReadonlySet<string> {
  read ??= new Set(load());
  return read;
}

export const inboxRead = {
  get: current,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  mark(key: string) {
    const keys = current();
    if (keys.has(key)) return;
    read = new Set([...keys, key].slice(-KEPT));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...read]));
    } catch {
      // Private browsing or a full quota: it stays read until the page reloads.
    }
    for (const listener of listeners) listener();
  },
};
