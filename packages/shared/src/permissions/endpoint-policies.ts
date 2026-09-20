import type { Actions, Subjects } from './abilities';

/**
 * A CASL rule an endpoint demands — the same `{ action, subject }` shape the
 * API's `@CheckPolicies` decorator takes, and the shape a client gates a
 * destination on.
 */
export interface EndpointPolicy {
  action: Actions;
  subject: Subjects;
}

/**
 * What each guarded endpoint demands, keyed by the route Nest mounts it at
 * (less the `/api/v1` prefix).
 *
 * This is one declaration of a rule that would otherwise be written twice:
 * once as `@CheckPolicies` on the controller, once as the policies a client
 * hides a destination behind. Nothing keeps two declarations in step, and when
 * they drift the sidebar hands a plain member a link that can only answer 403.
 * A client gating a row reads `ENDPOINT_POLICIES[<endpoint>]`; it never writes
 * the rules out again.
 *
 * `apps/api/src/auth/__tests__/endpoint-policies.spec.ts` asserts that each
 * endpoint below carries exactly the rules named here, and that the handler it
 * checks is really mounted at that path — so the assertion cannot quietly be
 * pointed at the wrong controller and go on passing.
 *
 * Only endpoints a client gates a destination on belong here. The rule list is
 * typed non-empty because an endpoint open to every signed-in account carries
 * no entry at all: an empty list would read as "anyone may call this", which is
 * exactly the ambiguity this catalog removes.
 */
export const ENDPOINT_POLICIES = {
  '/organizations/:orgId/members': [{ action: 'read', subject: 'Member' }],
  '/roles': [{ action: 'read', subject: 'Role' }],
  '/tokens': [{ action: 'read', subject: 'ApiToken' }],
  '/admin/users': [{ action: 'manage', subject: 'User' }],
  '/billing/subscriptions': [{ action: 'read', subject: 'Billing' }],
  // The control plane's projects. Keyed by path, which is why renaming a
  // project has no entry: `PATCH /projects/:id` shares its path with the read
  // below, and a rename is an action taken on a screen rather than a
  // destination a client gates a row on.
  '/projects': [{ action: 'read', subject: 'Project' }],
  '/projects/:id': [{ action: 'read', subject: 'Project' }],
} satisfies Record<string, readonly [EndpointPolicy, ...EndpointPolicy[]]>;

/** An endpoint whose rules are declared in {@link ENDPOINT_POLICIES}. */
export type GuardedEndpoint = keyof typeof ENDPOINT_POLICIES;
