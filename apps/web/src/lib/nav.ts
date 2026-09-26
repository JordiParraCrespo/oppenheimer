import { Plus, Settings, Terminal } from '@oppenheimer/design-system-web/icons';
import type { NavItem, NavLink } from '@oppenheimer/frontend-web';

/**
 * The workspace's destinations.
 *
 * There are two, and the console shows neither as a nav row: its sidebar *is*
 * the session list, and New session sits above it as a button. The list is
 * what `useAuthorizedNav` and the landing route read, which is why it still
 * exists — an app whose sidebar is its content still has to be able to answer
 * "where does a reader who chose nothing go".
 *
 * Settings is not a row here either: it is a destination of its own frame,
 * reached from the account menu (`USER_MENU` below), with its own nav and a
 * way back to the console (`design/version1/Settings.dc.html`, the 2026-09-26
 * frames). Profile arrives in that frame with its own slice.
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
  { to: '/sessions', icon: Terminal, labelKey: 'sessions', policies: [] },
  { to: '/sessions/new', icon: Plus, labelKey: 'newSession', policies: [] },
] as const satisfies readonly NavItem[];

/**
 * The account menu's links, above the language list: Settings, since the
 * 2026-09-26 frames draw it as a page (`product/versions/mvp/05-screens.md`).
 * Hosts is its one section today, so the link goes straight there.
 */
export const USER_MENU = [
  { to: '/settings/hosts', icon: Settings, labelKey: 'settings' },
] as const satisfies readonly NavLink[];
