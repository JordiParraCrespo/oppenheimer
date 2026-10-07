import { CircleCheck, GitPullRequest, Terminal, Zap } from '@oppenheimer/design-system-web/icons';
import type { ConsoleList } from '@/lib/console';

/**
 * What the rail offers, in the order a reader who never dragged one sees
 * it: each item's route, the console lists it stands for (Plan is the tasks
 * board and the calendar), its name and its glyph.
 */
export const RAIL = [
  {
    id: 'sessions',
    to: '/sessions/new',
    lists: ['sessions'],
    labelKey: 'nav.sessions',
    Icon: Terminal,
  },
  {
    id: 'pulls',
    to: '/pulls',
    lists: ['pulls'],
    labelKey: 'nav.pullRequests',
    Icon: GitPullRequest,
  },
  {
    id: 'automations',
    to: '/automations',
    lists: ['automations'],
    labelKey: 'nav.automations',
    Icon: Zap,
  },
  {
    id: 'plan',
    to: '/plan',
    lists: ['tasks', 'calendar'],
    labelKey: 'nav.plan',
    Icon: CircleCheck,
  },
] as const satisfies readonly {
  id: string;
  to: string;
  lists: readonly ConsoleList[];
  labelKey: string;
  Icon: unknown;
}[];

export type RailEntry = (typeof RAIL)[number];
export type RailItemId = RailEntry['id'];

export const RAIL_ORDER_KEY = 'oppenheimer.rail.order';

const BY_ID = new Map<string, RailEntry>(RAIL.map((entry) => [entry.id, entry]));

export function railEntry(id: string): RailEntry | undefined {
  return BY_ID.get(id);
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
  const kept = new Set<RailItemId>();
  if (Array.isArray(stored)) {
    for (const value of stored) {
      const entry = typeof value === 'string' ? railEntry(value) : undefined;
      if (entry) kept.add(entry.id);
    }
  }
  return [...kept, ...RAIL.map((entry) => entry.id).filter((id) => !kept.has(id))];
}

export function rememberRailOrder(order: readonly RailItemId[]) {
  try {
    window.localStorage.setItem(RAIL_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}
