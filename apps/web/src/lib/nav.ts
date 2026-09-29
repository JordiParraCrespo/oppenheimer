import { Plus, Settings2 } from '@oppenheimer/design-system-web/icons';
import type { NavItem, NavLink } from '@oppenheimer/frontend-web';

/**
 * The workspace's destinations.
 *
 * There is one, New session, and the console does not show it as a nav row:
 * its sidebar *is* the session list, with New session above it as a button.
 * With nothing open, New session is where the console lands. The list is
 * what the shell's sidebar and command palette read through the kit's
 * `useAuthorizedNav`, which is why it still exists.
 *
 * Settings is not a row either: it is the account menu's link (`USER_MENU`),
 * since the 2026-09-26 export drew it there, and it opens its own chrome
 * beside the console (`routes/settings.tsx`) rather than a pane inside it.
 *
 * Every row is ungated: a workspace is personal, so its owner reaches every
 * session and host in it. A row that does need a permission takes its
 * `policies` from `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`,
 * keyed by the method and route its screen reads
 * (`ENDPOINT_POLICIES['GET /tokens']`), never a rule list written out here —
 * the API's `endpoint-policies.spec.ts` holds the controller to that same
 * entry.
 */
export const NAV = [
  { to: '/sessions/new', icon: Plus, labelKey: 'newSession', policies: [] },
] as const satisfies readonly NavItem[];

/** The account menu's links, above appearance and language. */
export const USER_MENU = [
  { to: '/settings', icon: Settings2, labelKey: 'settings' },
] as const satisfies readonly NavLink[];
