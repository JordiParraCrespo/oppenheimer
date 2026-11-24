import { rememberList, storedList } from '@oppenheimer/frontend-web';

/**
 * What can be open as a tab over a session's page: a session, or a bot's
 * chat inside Sessions (`/sessions/bots/$botId`).
 */
export type OpenTab = { kind: 'session'; id: string } | { kind: 'bot'; id: string };

/**
 * The tabs this device keeps open, in the order they were opened, the way a
 * browser keeps its own: a tab is the reader's, not the session's, so the API
 * never hears of them, and another device opens its own.
 */
const OPEN_TABS_KEY = 'oppenheimer.sessions.tabs';

export function openTabKey(tab: OpenTab): string {
  return `${tab.kind}:${tab.id}`;
}

export function openTabOf(key: string): OpenTab | null {
  const at = key.indexOf(':');
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (at < 0 || id === '') return null;
  return kind === 'session' || kind === 'bot' ? { kind, id } : null;
}

/** `keys` with `key` at the end, unless it is open already: opening a tab never moves one. */
function withTabOpen(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? [...keys] : [...keys, key];
}

/**
 * The tab to show once `key` closes, when it is the shown one: the one after
 * it, else the one before, the way a browser closes a tab; null when it was
 * the last. Closing a tab that is not shown changes nothing on screen.
 */
export function tabAfterClosing(
  keys: readonly string[],
  shown: string | null,
  key: string,
): string | null {
  if (shown !== key) return shown;
  const at = keys.indexOf(key);
  const rest = keys.filter((one) => one !== key);
  return rest[Math.min(at, rest.length - 1)] ?? null;
}

/**
 * One store per page over the device's open tabs, so the strip on a session
 * and the strip on a bot read the same list, and another browser tab's
 * change reaches this one through the storage event.
 */
const listeners = new Set<() => void>();
const notify = () => {
  for (const onChange of listeners) onChange();
};
const fromOtherTab = (event: StorageEvent) => {
  if (event.key === OPEN_TABS_KEY || event.key === null) notify();
};

// `useSyncExternalStore` compares snapshots by identity: the same stored
// text answers the same array.
let lastRaw: string | null = null;
let lastKeys: readonly string[] = [];

function readKeys(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(OPEN_TABS_KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return lastKeys;
  lastRaw = raw;
  lastKeys = storedList(OPEN_TABS_KEY).filter((key) => openTabOf(key) !== null);
  return lastKeys;
}

function write(keys: readonly string[]) {
  // Private browsing or a full quota: the tabs drawn are the page they are on.
  if (rememberList(OPEN_TABS_KEY, keys)) notify();
}

export const openTabs = {
  subscribe(onChange: () => void): () => void {
    if (listeners.size === 0) window.addEventListener('storage', fromOtherTab);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener('storage', fromOtherTab);
    };
  },
  keys: readKeys,
  open(key: string): void {
    const keys = readKeys();
    if (!keys.includes(key)) write(withTabOpen(keys, key));
  },
  close(key: string): void {
    const keys = readKeys();
    if (keys.includes(key)) write(keys.filter((one) => one !== key));
  },
};
