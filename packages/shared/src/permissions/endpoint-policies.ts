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
 * What each guarded endpoint demands, keyed by **method and route** (the path
 * Nest mounts it at, less the `/api/v1` prefix).
 *
 * This is one declaration of a rule that would otherwise be written twice: once
 * as `@CheckPolicies` on the controller, once as the policies a client hides a
 * destination behind. Nothing keeps two declarations in step, and when they drift
 * the sidebar hands a plain member a link that can only answer 403. A client
 * gating a row reads `ENDPOINT_POLICIES['GET /tokens']`; it never writes the
 * rules out again.
 *
 * **The key carries the method, and that is what makes the catalog one thing.**
 * Keyed by path alone it had to be two: a list of sidebar destinations, plus a
 * handful of write paths whose whole path is one action — and the destructive
 * ones (closing a session, archiving a project) fell between the two, because
 * they share a path with a read. An endpoint is a method and a route, so that is
 * the key, and every entry means the same thing.
 *
 * `apps/api/src/auth/__tests__/endpoint-policies.spec.ts` asserts that each
 * endpoint below carries exactly the rules named here, and that the handler it
 * checks is really mounted at that method and path — so the assertion cannot
 * quietly be pointed at the wrong controller and go on passing.
 *
 * Only endpoints a client gates on belong here. The rule list is typed non-empty
 * because an endpoint open to every signed-in account carries no entry at all: an
 * empty list would read as "anyone may call this", which is exactly the ambiguity
 * this catalog removes.
 */
export const ENDPOINT_POLICIES = {
  'GET /organizations/:orgId/members': [{ action: 'read', subject: 'Member' }],
  'GET /roles': [{ action: 'read', subject: 'Role' }],
  'GET /tokens': [{ action: 'read', subject: 'ApiToken' }],
  'GET /admin/users': [{ action: 'manage', subject: 'User' }],
  'GET /billing/subscriptions': [{ action: 'read', subject: 'Billing' }],

  // The control plane's projects. Archiving is `update Project`, not `delete`,
  // because nothing is deleted: the row outlives the project so its slug — a
  // directory name on every host that held it — is never reissued.
  'GET /projects': [{ action: 'read', subject: 'Project' }],
  'GET /projects/:id': [{ action: 'read', subject: 'Project' }],
  'DELETE /projects/:id': [{ action: 'update', subject: 'Project' }],

  // The control plane's sessions. Opening a terminal is `update Session`: there is
  // no `attach` verb, and the scope split (`sessions:write`) is what keeps a
  // read-only credential from getting a PTY. Closing is `delete Session` and, like
  // archiving, deletes nothing.
  'GET /sessions': [{ action: 'read', subject: 'Session' }],
  'GET /sessions/:id': [{ action: 'read', subject: 'Session' }],
  'GET /sessions/:id/events': [{ action: 'read', subject: 'Session' }],
  'DELETE /sessions/:id': [{ action: 'delete', subject: 'Session' }],
  'POST /sessions/:id/stop': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/restart': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/checkouts': [{ action: 'update', subject: 'Session' }],
  'DELETE /sessions/:id/checkouts/:checkoutId': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/attach-ticket': [{ action: 'update', subject: 'Session' }],
} satisfies Record<string, readonly [EndpointPolicy, ...EndpointPolicy[]]>;

/** An endpoint whose rules are declared in {@link ENDPOINT_POLICIES}. */
export type GuardedEndpoint = keyof typeof ENDPOINT_POLICIES;
