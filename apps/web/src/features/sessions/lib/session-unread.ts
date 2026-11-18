import { storedList } from '@oppenheimer/frontend-web';

/**
 * The sessions the reader marked unread to come back to later, kept on this
 * device the way the pins are (`session-pins.ts`): their ids. A mark is the
 * reader's, not the session's, so the API never hears of it; opening the
 * session takes it off.
 */
const SESSION_UNREAD_KEY = 'oppenheimer.sidebar.unread';

/** `marks` with `id` marked unread, or read. */
function withUnread(marks: readonly string[], id: string, unread: boolean): string[] {
  const rest = marks.filter((markedId) => markedId !== id);
  return unread ? [id, ...rest] : rest;
}

/**
 * One store per page over the device's marks, so the session pane that takes
 * a mark off and the sidebar row that draws it read the same list, whichever
 * of them is mounted.
 */
const listeners = new Set<() => void>();
const notify = () => {
  for (const onChange of listeners) onChange();
};
// Another tab's write reaches this one only through the browser's storage event.
const fromOtherTab = (event: StorageEvent) => {
  if (event.key === SESSION_UNREAD_KEY || event.key === null) notify();
};

export const sessionUnread = {
  subscribe(onChange: () => void): () => void {
    if (listeners.size === 0) window.addEventListener('storage', fromOtherTab);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener('storage', fromOtherTab);
    };
  },
  has(id: string): boolean {
    return storedList(SESSION_UNREAD_KEY).includes(id);
  },
  set(id: string, unread: boolean): void {
    const current = storedList(SESSION_UNREAD_KEY);
    if (current.includes(id) === unread) return;
    try {
      window.localStorage.setItem(
        SESSION_UNREAD_KEY,
        JSON.stringify(withUnread(current, id, unread)),
      );
    } catch {
      // Private browsing or a full quota: no mark is kept, and none is drawn.
      return;
    }
    notify();
  },
};
