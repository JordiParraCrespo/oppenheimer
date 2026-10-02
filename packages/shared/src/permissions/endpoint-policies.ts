import type { Actions, Subjects } from './abilities.js';

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
 * One declaration of a rule that would otherwise be written twice — as
 * `@CheckPolicies` on the controller and as the policies a client hides a
 * destination behind — and that, drifted, hands a plain member a link that can
 * only answer 403. A client gating a row reads `ENDPOINT_POLICIES['GET /tokens']`;
 * it never writes the rules out again.
 *
 * **The key carries the method**: destructive endpoints (closing a session,
 * archiving a project) share a path with a read, so a path alone cannot name them.
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
  'GET /feature-flags/admin': [{ action: 'read', subject: 'FeatureFlag' }],

  // The control plane's projects. Archiving is `update Project`, not `delete`
  // (see `ProjectResource` in apps/api/src/projects/projects.resource.ts).
  'GET /projects': [{ action: 'read', subject: 'Project' }],
  'GET /projects/:id': [{ action: 'read', subject: 'Project' }],
  'POST /projects': [{ action: 'create', subject: 'Project' }],
  'PATCH /projects/:id': [{ action: 'update', subject: 'Project' }],
  'DELETE /projects/:id': [{ action: 'update', subject: 'Project' }],

  // The control plane's sessions. Opening a terminal is `update Session`
  // (`sessions:write` in the scope catalog says why). Closing is `delete Session`
  // and, like archiving, deletes nothing.
  'GET /sessions': [{ action: 'read', subject: 'Session' }],
  'GET /sessions/:id': [{ action: 'read', subject: 'Session' }],
  'GET /sessions/:id/events': [{ action: 'read', subject: 'Session' }],
  'DELETE /sessions/:id': [{ action: 'delete', subject: 'Session' }],
  'POST /sessions/prepare': [{ action: 'create', subject: 'Session' }],
  'POST /sessions/:id/stop': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/move': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/restart': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/checkouts': [{ action: 'update', subject: 'Session' }],
  'DELETE /sessions/:id/checkouts/:checkoutId': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/attach-ticket': [{ action: 'update', subject: 'Session' }],
  'POST /sessions/:id/images': [{ action: 'update', subject: 'Session' }],

  // Automations. Run now is `update Automation`; the session it starts is the
  // owner's, created through the sessions module as the owner.
  'GET /automations': [{ action: 'read', subject: 'Automation' }],
  'GET /automations/:id': [{ action: 'read', subject: 'Automation' }],
  'POST /automations': [{ action: 'create', subject: 'Automation' }],
  'PATCH /automations/:id': [{ action: 'update', subject: 'Automation' }],
  'DELETE /automations/:id': [{ action: 'delete', subject: 'Automation' }],
  'POST /automations/:id/run': [{ action: 'update', subject: 'Automation' }],
  'GET /automation-runs': [{ action: 'read', subject: 'Automation' }],
} satisfies Record<string, readonly [EndpointPolicy, ...EndpointPolicy[]]>;

/** An endpoint whose rules are declared in {@link ENDPOINT_POLICIES}. */
export type GuardedEndpoint = keyof typeof ENDPOINT_POLICIES;
