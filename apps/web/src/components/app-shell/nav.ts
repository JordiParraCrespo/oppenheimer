import { LayoutDashboard, type LucideIcon, Settings } from '@oppenheimer/design-system-web/icons';
import type { ScreenPolicy } from '@oppenheimer/shared/navigation';
import type { Messages } from '@oppenheimer/translations/locales';

/**
 * A CASL rule a row requires to be shown. A row lists the rules its
 * destination's data needs — the same `{ action, subject }` the API route
 * behind it checks — and the shell hides the row unless the signed-in user's
 * ability satisfies **every** one (matching the server's `PoliciesGuard`, which
 * ANDs its policies). A row with no policies is always visible.
 */
export type NavPolicy = ScreenPolicy;

/**
 * The workspace's destinations, in the order the sidebar lists them: Dashboard
 * first, then the working surfaces, with Settings held back at the bottom. One
 * model, read by both the sidebar and the command palette, so a page can never
 * appear in one and not the other.
 */
interface NavEntry {
  /** Route path — also the key its label is looked up under in `nav.*`. */
  to: string;
  icon: LucideIcon;
  labelKey: keyof Messages['nav'];
  /**
   * The permissions this row's destination needs — taken from `SCREENS` in
   * `@oppenheimer/shared/navigation`, never written out here, so a row cannot claim
   * less than the endpoint behind it enforces. Empty means always visible: the
   * dashboard reads only the caller's own profile, and every user manages
   * their own API tokens under Settings.
   */
  policies: readonly NavPolicy[];
}

// `satisfies` rather than a type annotation, so `to` stays a literal — which is
// what TanStack Router's `Link` wants.
export const NAV = [
  {
    to: '/dashboard',
    icon: LayoutDashboard,
    labelKey: 'dashboard',
    policies: [],
  },
] as const satisfies readonly NavEntry[];

export const SETTINGS_NAV = {
  to: '/settings',
  icon: Settings,
  labelKey: 'settings',
  policies: [],
} as const satisfies NavEntry;

/** One row of the workspace nav — a `NAV` entry or the pinned Settings row. */
export type NavItem = (typeof NAV)[number] | typeof SETTINGS_NAV;
