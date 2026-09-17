import { Plus, Settings, Terminal, UserRound } from '@oppenheimer/design-system-web/icons';
import type { NavItem, NavLink } from '@oppenheimer/frontend-web';

/**
 * The workspace's destinations, in the order the sidebar lists them: the
 * sessions list first (it is the product; the sidebar of
 * `product/versions/mvp/05-screens.md` is this list with a state dot per
 * session), then New session, with Settings (hosts, API tokens) held back at
 * the bottom. One model, read by both the sidebar and the command palette, so
 * a page can never appear in one and not the other.
 *
 * Every row is ungated: a workspace is personal, so its owner reaches every
 * session and host in it, and every user manages their own API tokens under
 * Settings. A row that does need a permission takes its `policies` from
 * `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by the
 * endpoint its screen reads (`ENDPOINT_POLICIES['/tokens']`), never a rule
 * list written out here — the API's `endpoint-policies.spec.ts` holds the
 * controller to that same entry.
 */
export const NAV = [
  { to: '/sessions', icon: Terminal, labelKey: 'sessions', policies: [] },
  { to: '/sessions/new', icon: Plus, labelKey: 'newSession', policies: [] },
  { to: '/settings', icon: Settings, labelKey: 'settings', policies: [] },
] as const satisfies readonly NavItem[];

/** The account menu's own destinations, above the language list. */
export const USER_MENU_LINKS = [
  { to: '/profile', icon: UserRound, labelKey: 'viewProfile' },
  { to: '/settings', icon: Settings, labelKey: 'settings' },
] as const satisfies readonly NavLink[];
