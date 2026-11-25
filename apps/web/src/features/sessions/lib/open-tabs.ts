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
 * `keys` with the tabs the reader dragged into `order`: those of them kept
 * take its order in the places they held, every key the strip did not draw
 * (a tab whose list is loading, one gone elsewhere) keeps its place, and a
 * drawn tab not kept yet (the page on screen) is kept at the end.
 */
export function withTabsOrdered(keys: readonly string[], order: readonly string[]): string[] {
  const drawn = new Set(order);
  const kept = order.filter((key) => keys.includes(key));
  let next = 0;
  const placed = keys.map((key) => (drawn.has(key) ? (kept[next++] ?? key) : key));
  return [...placed, ...order.filter((key) => !keys.includes(key))];
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
