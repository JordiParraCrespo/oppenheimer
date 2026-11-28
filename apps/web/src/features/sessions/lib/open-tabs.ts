/**
 * What can be open as a tab over a session's page: a session, or a bot's
 * chat inside Sessions (`/sessions/bots/$botId`).
 */
export type OpenTab = { kind: 'session'; id: string } | { kind: 'bot'; id: string };

/**
 * The tabs this device keeps open, in the order they were opened or the
 * reader dragged them into, the way a browser keeps its own: a tab is the reader's, not the session's, so the API
 * never hears of them, and another device opens its own.
 */
export const OPEN_TABS_KEY = 'oppenheimer.sessions.tabs';

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

/**
 * `keys` with the tabs the reader dragged into `order`: they take its order,
 * each key the strip did not draw (a tab whose list is loading, one gone
 * elsewhere) stays after the drawn tab it followed, and a drawn tab not
 * kept yet (the page on screen) is kept where it was dropped.
 */
export function withTabsOrdered(keys: readonly string[], order: readonly string[]): string[] {
  const drawn = new Set(order);
  const leading: string[] = [];
  const after = new Map<string, string[]>();
  let anchor: string | null = null;
  for (const key of keys) {
    if (drawn.has(key)) anchor = key;
    else if (anchor === null) leading.push(key);
    else after.set(anchor, [...(after.get(anchor) ?? []), key]);
  }
  return [...leading, ...order.flatMap((key) => [key, ...(after.get(key) ?? [])])];
}

/** `keys` with `key` at the end, unless it is open already: opening a tab never moves one. */
export function withTabOpen(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys : [...keys, key];
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

/** What a tab's menu closes, the way a browser's does: counted from the tab it opened on. */
export type CloseTabs = 'this' | 'others' | 'left' | 'right' | 'all';

/** The keys `which` closes, read from the tab `key` in `keys`, the strip's order. */
export function tabsToClose(keys: readonly string[], key: string, which: CloseTabs): string[] {
  const at = keys.indexOf(key);
  if (at < 0) return [];
  switch (which) {
    case 'this':
      return [key];
    case 'others':
      return keys.filter((one) => one !== key);
    case 'left':
      return keys.slice(0, at);
    case 'right':
      return keys.slice(at + 1);
    case 'all':
      return [...keys];
  }
}

/**
 * The tab to show once the menu of `key` closes `closed`: the one on screen
 * when it stays, else `key` itself when it stays (a browser lights the tab
 * whose menu it was), else the first tab left after the one on screen, else
 * the last left before it; null when nothing is left.
 */
export function tabAfterClosingMany(
  keys: readonly string[],
  shown: string | null,
  key: string,
  closed: readonly string[],
): string | null {
  if (shown === null || !closed.includes(shown)) return shown;
  if (!closed.includes(key)) return key;
  const at = keys.indexOf(shown);
  const remaining = keys.filter((one) => !closed.includes(one));
  const before = remaining.filter((one) => keys.indexOf(one) < at);
  return remaining.find((one) => keys.indexOf(one) > at) ?? before.at(-1) ?? null;
}

/**
 * How many tabs the strip drew the last time both lists answered on this
 * device. The stored tabs can hold some whose session or bot is gone, which
 * only the lists can tell, so while they load the strip draws no more
 * placeholders than this, the count it ended with last time.
 */
const DRAWN_TABS_KEY = 'oppenheimer.sessions.tabs.drawn';

export function readDrawnTabCount(): number | null {
  try {
    const stored = Number.parseInt(window.localStorage.getItem(DRAWN_TABS_KEY) ?? '', 10);
    return Number.isInteger(stored) && stored >= 0 ? stored : null;
  } catch {
    return null;
  }
}

export function writeDrawnTabCount(count: number): void {
  try {
    window.localStorage.setItem(DRAWN_TABS_KEY, String(count));
  } catch {
    // Storage refused (private browsing, a full quota): the next load draws every placeholder.
  }
}

/**
 * `tabs` with no more placeholders than `last` leaves room for beside the
 * tabs already drawn, keeping the first ones in order; all of them when
 * there is no `last` (a device that has not drawn the strip yet).
 */
export function withPlaceholdersCapped<T extends { placeholder: boolean }>(
  tabs: readonly T[],
  last: number | null,
): T[] {
  if (last === null) return [...tabs];
  let room = last - tabs.filter((one) => !one.placeholder).length;
  return tabs.filter((one) => !one.placeholder || room-- > 0);
}
