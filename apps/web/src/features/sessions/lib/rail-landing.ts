/**
 * The rail's items by id and route, in the order a reader who never dragged
 * one sees it, and the reader's own order as this device keeps it. Apart from
 * the names and glyphs (`rail-order.ts`) because `/` reads it to pick where
 * the console opens, and that route is on the first load. The Inbox leads:
 * it is where the console opens until the reader drags another item above it.
 */
export const RAIL_ROUTES = [
  { id: 'inbox', to: '/inbox' },
  { id: 'bots', to: '/bots' },
  { id: 'sessions', to: '/sessions/new' },
  { id: 'pulls', to: '/pulls' },
  { id: 'automations', to: '/automations' },
  { id: 'plan', to: '/plan/open' },
] as const;

export type RailItemId = (typeof RAIL_ROUTES)[number]['id'];

export const RAIL_ORDER_KEY = 'oppenheimer.rail.order';

/**
 * The Inbox goes first for everyone once (`product/design/console/inbox.md`, "Its own page"): an
 * order stored while it was Plan's section lacks it, and gets it at the
 * front rather than the end. Once the reader drags, the order they drop is
 * kept as it is.
 */
const LEADS_WHEN_ADDED: RailItemId = 'inbox';

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
 * default place, but the Inbox at the front. Unknown ids and repeats are
 * dropped; anything unreadable is the default order.
 */
export function storedRailOrder(): RailItemId[] {
  const kept = new Set<RailItemId>(storedIds().filter(isRailItemId));
  const added = RAIL_ROUTES.map((item) => item.id).filter((id) => !kept.has(id));
  const leading = added.filter((id) => id === LEADS_WHEN_ADDED);
  return [...leading, ...kept, ...added.filter((id) => id !== LEADS_WHEN_ADDED)];
}

export function rememberRailOrder(order: readonly RailItemId[]) {
  try {
    window.localStorage.setItem(RAIL_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}

/**
 * Where the console opens: the first item of the reader's order, the Inbox
 * for a reader who never dragged the rail, so a reader who dragged Employees
 * to the top lands there.
 */
export function railLanding(): (typeof RAIL_ROUTES)[number]['to'] {
  const first = storedRailOrder()[0];
  return RAIL_ROUTES.find((item) => item.id === first)?.to ?? '/inbox';
}
