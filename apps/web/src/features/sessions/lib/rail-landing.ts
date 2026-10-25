/**
 * The rail's items by id and route, in the order a reader who never dragged
 * one sees it, and the reader's own order as this device keeps it. Apart from
 * the names and glyphs (`rail-order.ts`) because `/` reads it to pick where
 * the console opens, and that route is on the first load.
 */
export const RAIL_ROUTES = [
  { id: 'bots', to: '/bots' },
  { id: 'sessions', to: '/sessions/new' },
  { id: 'pulls', to: '/pulls' },
  { id: 'automations', to: '/automations' },
  { id: 'plan', to: '/plan' },
] as const;

export type RailItemId = (typeof RAIL_ROUTES)[number]['id'];

export const RAIL_ORDER_KEY = 'oppenheimer.rail.order';

const IDS = new Set<string>(RAIL_ROUTES.map((item) => item.id));

function isRailItemId(value: unknown): value is RailItemId {
  return typeof value === 'string' && IDS.has(value);
}

/**
 * The reader's own order, kept on this device: every item once, the stored
 * ones first in their stored place, then any this build added since in their
 * default place. Unknown ids and repeats are dropped; anything unreadable is
 * the default order.
 */
export function storedRailOrder(): RailItemId[] {
  let stored: unknown = [];
  try {
    stored = JSON.parse(window.localStorage.getItem(RAIL_ORDER_KEY) ?? '[]');
  } catch {
    // Storage switched off, or something from an older shape: the default order.
  }
  const kept = new Set<RailItemId>(Array.isArray(stored) ? stored.filter(isRailItemId) : []);
  return [...kept, ...RAIL_ROUTES.map((item) => item.id).filter((id) => !kept.has(id))];
}

export function rememberRailOrder(order: readonly RailItemId[]) {
  try {
    window.localStorage.setItem(RAIL_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}

/**
 * Where the console opens: the first item of the reader's order, so a
 * reader who dragged Plan to the top lands on Plan, and one who never
 * dragged lands on Employees.
 */
export function railLanding(): (typeof RAIL_ROUTES)[number]['to'] {
  const [first] = storedRailOrder();
  return RAIL_ROUTES.find((item) => item.id === first)?.to ?? RAIL_ROUTES[0].to;
}
