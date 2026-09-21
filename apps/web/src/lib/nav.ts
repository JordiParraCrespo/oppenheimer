import { Plus, Terminal } from '@oppenheimer/design-system-web/icons';
import type { NavItem } from '@oppenheimer/frontend-web';

/**
 * The workspace's destinations.
 *
 * There are two, and the console shows neither as a nav row: its sidebar *is*
 * the session list, and New session sits above it as a button. The list is
 * what `useAuthorizedNav` and the landing route read, which is why it still
 * exists — an app whose sidebar is its content still has to be able to answer
 * "where does a reader who chose nothing go".
 *
 * Settings and Profile are deliberately absent, and so are their screens. The
 * version-1 artboards carry neither anywhere in the console — the account menu
 * holds appearance, language and log out — and hosts arrive through onboarding.
 * `05-screens.md` describes a settings drawer that version 1 does not draw;
 * when it is drawn, it is a drawer, not a destination, and does not belong in
 * this list.
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
