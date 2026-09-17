import type { LucideIcon } from '@oppenheimer/design-system-web/icons';
import type { EndpointPolicy } from '@oppenheimer/shared/permissions';
import type { Messages } from '@oppenheimer/translations/locales';
import type { LinkProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * A route the shell may link to. Under an app's program this is that app's
 * own route union (TanStack Router's `Register` is global), so an app's nav
 * cannot name a route it does not have; under the kit's own typecheck, where
 * no router is registered, it is a string.
 */
export type NavTo = NonNullable<LinkProps['to']>;

/**
 * A CASL rule a row requires to be shown. A row lists the rules its
 * destination's data needs — the same `{ action, subject }` the API route
 * behind it checks — and the shell hides the row unless the signed-in user's
 * ability satisfies **every** one (matching the server's `PoliciesGuard`, which
 * ANDs its policies). A row with no policies is always visible.
 */
export type NavPolicy = EndpointPolicy;

/**
 * One row of an app's navigation: what the sidebar lists and the command
 * palette offers. The app declares its rows (`lib/nav.ts`), the shell renders
 * them; the two can never disagree because there is one list.
 */
export interface NavItem {
  /** Route path — also the key its label is looked up under in `nav.*`. */
  to: NavTo;
  icon: LucideIcon;
  labelKey: keyof Messages['nav'];
  /**
   * The permissions this row's destination needs. A gated row takes them from
   * `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by the endpoint
   * its screen reads — never a literal rule list, so a row cannot claim less
   * than the endpoint behind it enforces. Omitted or empty means always
   * visible.
   */
  policies?: readonly NavPolicy[];
}

/** A row of the account menu: a link with an icon and a `nav.*` label. */
export interface NavLink {
  to: NavTo;
  icon: LucideIcon;
  labelKey: keyof Messages['nav'];
}

/** What the shell shows as the workspace in the sidebar header. */
export interface ShellWorkspace {
  name: string;
  logo?: string | null;
  /** Rendered instead of the avatar when the workspace is the product itself (the control plane's glyph). */
  icon?: ReactNode;
}
