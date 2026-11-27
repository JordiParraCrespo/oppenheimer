import {
  AlarmClock,
  Bot,
  GitPullRequest,
  Inbox,
  Layers,
  Terminal,
} from '@oppenheimer/design-system-web/icons';
import type { ConsoleList } from '@/lib/console';
import { RAIL_ROUTES, type RailItemId } from './rail-landing';

/**
 * What each rail item looks like and stands for: the console lists it
 * switches to (Plan is the tasks board and the calendar), its name, the one
 * the phone's tab bar prints under the glyph (shorter where the name does not
 * fit there), and its glyph. The ids, routes and order are `rail-landing.ts`'s.
 */
const LOOK = {
  inbox: { lists: ['inbox'], labelKey: 'nav.inbox', shortLabelKey: 'nav.inbox', Icon: Inbox },
  bots: {
    lists: ['bots'],
    labelKey: 'nav.employees',
    shortLabelKey: 'nav.employeesShort',
    Icon: Bot,
  },
  sessions: {
    lists: ['sessions'],
    labelKey: 'nav.sessions',
    shortLabelKey: 'nav.sessions',
    Icon: Terminal,
  },
  pulls: {
    lists: ['pulls'],
    labelKey: 'nav.pullRequests',
    shortLabelKey: 'nav.pullRequestsShort',
    Icon: GitPullRequest,
  },
  automations: {
    lists: ['automations'],
    labelKey: 'nav.automations',
    shortLabelKey: 'nav.automationsShort',
    Icon: AlarmClock,
  },
  plan: {
    lists: ['tasks', 'calendar'],
    labelKey: 'nav.plan',
    shortLabelKey: 'nav.plan',
    Icon: Layers,
  },
} as const satisfies Record<
  RailItemId,
  { lists: readonly ConsoleList[]; labelKey: string; shortLabelKey: string; Icon: unknown }
>;

const RAIL = RAIL_ROUTES.map((item) => ({ ...item, ...LOOK[item.id] }));

export type RailEntry = (typeof RAIL)[number];

const BY_ID = new Map<string, RailEntry>(RAIL.map((entry) => [entry.id, entry]));

export function railEntry(id: string): RailEntry | undefined {
  return BY_ID.get(id);
}
