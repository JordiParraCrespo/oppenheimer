/** The rail's lists, in the order a reader who never dragged one sees them. */
export const RAIL_ITEMS = ['sessions', 'pulls', 'automations', 'plan'] as const;

export type RailItemId = (typeof RAIL_ITEMS)[number];

const STORAGE_KEY = 'oppenheimer.rail.order';

const isRailItem = (value: unknown): value is RailItemId =>
  typeof value === 'string' && (RAIL_ITEMS as readonly string[]).includes(value);

/**
 * The reader's own order, kept on this device the way the design keeps it
 * (`product/versions/mvp/design/version1/rail-order.js`): every list once,
 * the stored ones first in their stored place, then any this build added
 * since, in their default place. Anything unreadable is the default order.
 */
export function storedRailOrder(): RailItemId[] {
  let stored: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(parsed)) stored = parsed;
  } catch {
    // Storage switched off, or something from an older shape: the default order.
  }
  const kept = [...new Set(stored.filter(isRailItem))];
  return [...kept, ...RAIL_ITEMS.filter((id) => !kept.includes(id))];
}

export function rememberRailOrder(order: readonly string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order.filter(isRailItem)));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}
