import type { Actions, Subjects } from '../permissions';

/**
 * A CASL rule a screen's data needs — the same `{ action, subject }` shape the
 * API's `@CheckPolicies` decorator takes.
 */
export interface ScreenPolicy {
  action: Actions;
  subject: Subjects;
}

/**
 * The workspace destinations the front end gates on permissions.
 *
 * Screens open to every signed-in account — the dashboard, the profile,
 * settings — carry no entry: an empty policy list would read as "show this to
 * everyone", which is exactly the ambiguity this catalog exists to remove.
 */
export const SCREEN_ROUTES = ['/team', '/roles', '/api-tokens', '/admin', '/billing'] as const;

export type ScreenRoute = (typeof SCREEN_ROUTES)[number];

/**
 * What each screen needs before it is worth offering, and the endpoint that
 * decides it.
 *
 * This is one declaration of a rule that would otherwise be written twice:
 * once as the web sidebar's per-row policies, once as `@CheckPolicies` on the
 * controller behind it. Nothing keeps two declarations in step, and when they
 * drift the sidebar hands a plain member links that can only answer 403.
 *
 * The sidebar reads its policies from here, and
 * `apps/api/src/auth/__tests__/screen-policies.spec.ts` asserts that each
 * `endpoint` below carries exactly the rules named here. Change a controller's
 * `@CheckPolicies` and that test fails; the nav cannot silently fall behind it.
 *
 * `endpoint` is the route Nest mounts the handler at, less the `/api/v1`
 * prefix, and is asserted too — so the assertion cannot quietly be pointed at
 * the wrong controller and go on passing about a screen it is not checking.
 */
export const SCREENS = {
  '/team': {
    endpoint: '/organizations/:orgId/members',
    policies: [{ action: 'read', subject: 'Member' }],
  },
  '/roles': {
    endpoint: '/roles',
    policies: [{ action: 'read', subject: 'Role' }],
  },
  '/api-tokens': {
    endpoint: '/tokens',
    policies: [{ action: 'read', subject: 'ApiToken' }],
  },
  '/admin': {
    endpoint: '/admin/users',
    policies: [{ action: 'manage', subject: 'User' }],
  },
  '/billing': {
    endpoint: '/billing/subscriptions',
    policies: [{ action: 'read', subject: 'Billing' }],
  },
} as const satisfies Record<ScreenRoute, { endpoint: string; policies: readonly ScreenPolicy[] }>;
