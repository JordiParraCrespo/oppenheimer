import { Plus, Terminal, UserRound } from '@oppenheimer/design-system-web/icons';
import type { NavItem, NavLink } from '@oppenheimer/frontend-web';

/**
 * The workspace's destinations, read by the command palette — and, in an app
 * that passes no sidebar of its own, by the sidebar too. The console passes
 * one: its sidebar *is* the session list, which is why there is no Sessions
 * row here to duplicate it.
 *
 * Settings is deliberately absent. The version-1 artboards carry no settings
 * anywhere in the console — not in the sidebar and not in the account menu,
 * which holds appearance, language and log out — and hosts arrive through
 * onboarding. `05-screens.md` describes a settings drawer that version 1 does
 * not draw; when it is drawn, it is a drawer, not a destination, and does not
 * belong in this list.
 *
 * Every row is ungated: a workspace is personal, so its owner reaches every
 * session and host in it. A row that does need a permission takes its `policies` from
 * `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by the
 * method and route its screen reads (`ENDPOINT_POLICIES['GET /tokens']`),
 * never a rule list written out here — the API's `endpoint-policies.spec.ts`
 * holds the controller to that same entry.
 */
export const NAV = [
  { to: '/sessions', icon: Terminal, labelKey: 'sessions', policies: [] },
  { to: '/sessions/new', icon: Plus, labelKey: 'newSession', policies: [] },
] as const satisfies readonly NavItem[];

/** The account menu's own destinations, above the language list. */
export const USER_MENU_LINKS = [
  { to: '/profile', icon: UserRound, labelKey: 'viewProfile' },
] as const satisfies readonly NavLink[];
