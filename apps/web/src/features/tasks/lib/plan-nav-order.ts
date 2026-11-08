/**
 * Plan's sidebar views by id, in the order a reader who never dragged one
 * sees them (the 2026-11-08 `Tasks` frame, then Projects, which moved here
 * from the Sessions sidebar), and the reader's own order as
 * this device keeps it.
 */
export const PLAN_NAV_IDS = [
  'inbox',
  'tasks',
  'todo',
  'milestones',
  'calendar',
  'projects',
] as const;

export type PlanNavId = (typeof PLAN_NAV_IDS)[number];

export const PLAN_NAV_ORDER_KEY = 'oppenheimer.plan.nav.order';

const IDS = new Set<string>(PLAN_NAV_IDS);

export function isPlanNavId(value: unknown): value is PlanNavId {
  return typeof value === 'string' && IDS.has(value);
}

/**
 * The reader's own order: every view once, the stored ones in their stored
 * place, then any this build added since in their default place. Unknown
 * ids and repeats are dropped; anything unreadable is the default order.
 */
export function storedPlanNavOrder(): PlanNavId[] {
  let stored: unknown;
  try {
    stored = JSON.parse(window.localStorage.getItem(PLAN_NAV_ORDER_KEY) ?? '[]');
  } catch {
    // Storage switched off, or something from an older shape: the default order.
    stored = [];
  }
  const kept = new Set<PlanNavId>(Array.isArray(stored) ? stored.filter(isPlanNavId) : []);
  return [...kept, ...PLAN_NAV_IDS.filter((id) => !kept.has(id))];
}

/**
 * `order` with its shown views refilled from `moved` in their new order; a
 * hidden view (the Inbox without its flag) keeps the slot it had.
 */
export function mergeShownOrder(
  order: readonly PlanNavId[],
  moved: readonly PlanNavId[],
  shown: (id: PlanNavId) => boolean,
): PlanNavId[] {
  const next = moved[Symbol.iterator]();
  return order.map((id) => (shown(id) ? (next.next().value ?? id) : id));
}

export function rememberPlanNavOrder(order: readonly PlanNavId[]) {
  try {
    window.localStorage.setItem(PLAN_NAV_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}
