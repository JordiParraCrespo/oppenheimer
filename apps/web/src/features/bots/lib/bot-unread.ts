import { storedList, withListedFirst } from '@oppenheimer/frontend-web';

/**
 * The bots the reader marked unread to come back to later, kept on this
 * device as a session's marks are: their ids. A mark is the reader's, not the
 * bot's, so the API never hears of it; opening the bot's chat takes it off.
 */
const BOT_UNREAD_KEY = 'oppenheimer.bots.unread';

/**
 * One store per page over the device's marks, so the chat that takes a mark
 * off and the sidebar row that draws it read the same list, whichever of them
 * is mounted.
 */
const listeners = new Set<() => void>();
const notify = () => {
  for (const onChange of listeners) onChange();
};
// Another tab's write reaches this one only through the browser's storage event.
const fromOtherTab = (event: StorageEvent) => {
  if (event.key === BOT_UNREAD_KEY || event.key === null) notify();
};

export const botUnread = {
  subscribe(onChange: () => void): () => void {
    if (listeners.size === 0) window.addEventListener('storage', fromOtherTab);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener('storage', fromOtherTab);
    };
  },
  has(id: string): boolean {
    return storedList(BOT_UNREAD_KEY).includes(id);
  },
  set(id: string, unread: boolean): void {
    const current = storedList(BOT_UNREAD_KEY);
    if (current.includes(id) === unread) return;
    try {
      window.localStorage.setItem(
        BOT_UNREAD_KEY,
        JSON.stringify(withListedFirst(current, id, unread)),
      );
    } catch {
      // Private browsing or a full quota: no mark is kept, and none is drawn.
      return;
    }
    notify();
  },
};
