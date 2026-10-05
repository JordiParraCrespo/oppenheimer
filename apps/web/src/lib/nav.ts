import { Plus, Settings2 } from '@oppenheimer/design-system-web/icons';
import type { NavItem, NavLink } from '@oppenheimer/frontend-web';

/**
 * The workspace's destinations. There is one, New session, which the console
 * draws as the button above the session list rather than a nav row; the list
 * exists because the shell's sidebar and command palette read it through the
 * kit's `useAuthorizedNav`. Settings is the account menu's link (`USER_MENU`),
 * opening its own chrome (`routes/_authenticated/settings.tsx`).
 *
 * Every row is ungated: a workspace is personal, so its owner reaches every
 * session and host in it. A row that needs a permission takes its `policies`
 * from `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by the
 * route its screen reads (`ENDPOINT_POLICIES['GET /tokens']`), never a rule
 * list written here; the API's `endpoint-policies.spec.ts` holds the
 * controller to that same entry.
 */
export const NAV = [
  { to: '/sessions/new', icon: Plus, labelKey: 'newSession', policies: [] },
] as const satisfies readonly NavItem[];

/** The account menu's links, above appearance and language. */
export const USER_MENU = [
  { to: '/settings', icon: Settings2, labelKey: 'settings' },
] as const satisfies readonly NavLink[];
