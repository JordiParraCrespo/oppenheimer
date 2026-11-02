/**
 * The rail's items by id and route, in the order a reader who never dragged
 * one sees it, and the reader's own order as this device keeps it. Apart from
 * the names and glyphs (`rail-order.ts`) because `/` reads it to pick where
 * the console opens, and that route is on the first load. Plan opens on its
 * Inbox, its first section since the 2026-10-29 frame.
 */
export const RAIL_ROUTES = [
  { id: 'bots', to: '/bots' },
  { id: 'sessions', to: '/sessions/new' },
  { id: 'pulls', to: '/pulls' },
  { id: 'automations', to: '/automations' },
  { id: 'plan', to: '/plan/inbox' },
] as const;

export type RailItemId = (typeof RAIL_ROUTES)[number]['id'];

export const RAIL_ORDER_KEY = 'oppenheimer.rail.order';

/** Where the console lands unless the reader put another item first: Plan's Inbox. */
const INBOX_LANDING = '/plan/inbox';

/**
 * The rail item the Inbox was before it moved into Plan. An order stored
 * then still names it; it is no item now, and an order that led with it
 * still lands on the Inbox.
 */
const FORMER_INBOX = 'inbox';

const IDS = new Set<string>(RAIL_ROUTES.map((item) => item.id));

function isRailItemId(value: unknown): value is RailItemId {
  return typeof value === 'string' && IDS.has(value);
}

/** What this device stored, as it stored it; anything unreadable is nothing. */
function storedIds(): unknown[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(RAIL_ORDER_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    // Storage switched off, or something from an older shape: the default order.
    return [];
  }
}

/**
 * The reader's own order, kept on this device: every item once, the stored
 * ones in their stored place, then any this build added since in their
 * default place. Unknown ids (the former Inbox among them) and repeats are
 * dropped; anything unreadable is the default order.
 */
export function storedRailOrder(): RailItemId[] {
  const kept = new Set<RailItemId>(storedIds().filter(isRailItemId));
  const added = RAIL_ROUTES.map((item) => item.id).filter((id) => !kept.has(id));
  return [...kept, ...added];
}

export function rememberRailOrder(order: readonly RailItemId[]) {
  try {
    window.localStorage.setItem(RAIL_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}

/**
 * Where the console opens (`product/versions/mvp/29-inbox.md`, Decided 1):
 * Plan's Inbox for a reader who never dragged the rail, or whose stored
 * order led with the Inbox when it was a rail item; otherwise the first item
 * of the reader's order, so a reader who dragged Employees to the top lands
 * there.
 */
export function railLanding(): (typeof RAIL_ROUTES)[number]['to'] {
  const first = storedIds().find((id) => id === FORMER_INBOX || isRailItemId(id));
  if (first === undefined || first === FORMER_INBOX) return INBOX_LANDING;
  return RAIL_ROUTES.find((item) => item.id === first)?.to ?? INBOX_LANDING;
}
