import { type AccessScope, applyAccessScope, expectAbility } from '@oppenheimer/backend-authz';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { SessionResource } from '../sessions.resource';

/**
 * The proof that a session is workspace-owned and nothing more.
 *
 * Two halves, because both have to hold and they fail independently: the SQL
 * predicate decides which rows a query returns, the CASL ability decides what
 * `can()` reports to a caller and to the console. They are generated from the same
 * declaration, and these tests are what keep that true.
 *
 * What makes this resource worth its own spec is the contrast with the host it runs
 * on. A host is a **person's** — own-or-grant, no tenant clause — and a session is
 * the **workspace's**. `work_session.organizationId` is the tenant boundary in this
 * design, so if this predicate ever stopped constraining it, the fact that the host
 * is borrowed would become a cross-tenant read.
 */

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'member-1',
    organizationId: 'org-acme',
    teamIds: [],
    grants: new Map(),
    bypass: false,
    ...overrides,
  };
}

/** Records the clauses a query would carry, without needing a database. */
function fakeQueryBuilder() {
  const calls: { clause: string; parameters?: Record<string, unknown> }[] = [];
  const qb = {
    alias: 'session',
    andWhere(clause: string, parameters?: Record<string, unknown>) {
      calls.push({ clause, parameters });
      return qb;
    },
    calls,
  };
  // biome-ignore lint/suspicious/noExplicitAny: structural double for the query builder
  return qb as any;
}

function whereClausesFor(callerScope: AccessScope): string[] {
  const qb = fakeQueryBuilder();
  applyAccessScope(qb, SessionResource, callerScope);
  return qb.calls.map((call: { clause: string }) => call.clause);
}

/** What the org-scoped `owner` role holds over sessions, as its migration writes it. */
const WORKSPACE_SESSIONS: PermissionDefinition[] = [
  {
    action: 'manage',
    subject: 'Session',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated when the ability is built
    conditions: { organizationId: '${scope.organizationId}' },
  },
];

describe('session row scoping (SQL)', () => {
  it('constrains the tenant, and that is the whole predicate', () => {
    expect(whereClausesFor(scope({ teamIds: ['team-madrid'] }))).toEqual([
      'session.organizationId = :authzOrganizationId',
    ]);
  });

  it('does not narrow to the caller who created the session', () => {
    // Deliberate: a session is the workspace's work, not the author's. If this ever
    // became `own`, a teammate could not open a terminal on a session they can see.
    expect(whereClausesFor(scope({ userId: 'someone-else' }))).toEqual([
      'session.organizationId = :authzOrganizationId',
    ]);
  });

  it('returns nothing for a caller with no active workspace', () => {
    expect(whereClausesFor(scope({ organizationId: null }))).toEqual(['1 = 0']);
  });

  it('drops every filter for a platform-tier caller', () => {
    expect(whereClausesFor(scope({ bypass: true }))).toEqual([]);
  });
});

describe('session capabilities (CASL)', () => {
  it('lets a workspace member run the sessions of their own workspace', () => {
    expectAbility(WORKSPACE_SESSIONS, { user: { id: 'member-1' }, scope: scope() })
      .canOn('read', 'Session', { organizationId: 'org-acme' })
      .canOn('create', 'Session', { organizationId: 'org-acme' })
      // Opening a terminal is `update`, which is why there is no `attach` action to
      // assert here: the scope split is what separates a reader from a shell.
      .canOn('update', 'Session', { organizationId: 'org-acme' })
      .canOn('delete', 'Session', { organizationId: 'org-acme' });
  });

  it('does not let them reach another workspace’s session', () => {
    expectAbility(WORKSPACE_SESSIONS, {
      user: { id: 'member-1' },
      scope: scope(),
    }).cannotOn('read', 'Session', { organizationId: 'org-other' });
  });

  it('does not let them open a terminal on another workspace’s session', () => {
    // The one that matters most: a PTY on somebody else's machine.
    expectAbility(WORKSPACE_SESSIONS, {
      user: { id: 'member-1' },
      scope: scope(),
    }).cannotOn('update', 'Session', { organizationId: 'org-other' });
  });

  it('gives a caller with no active workspace nothing', () => {
    expectAbility(WORKSPACE_SESSIONS, {
      user: { id: 'member-1' },
      scope: scope({ organizationId: null }),
    }).cannotOn('read', 'Session', { organizationId: 'org-acme' });
  });
});

describe('the declaration itself', () => {
  it('names a column for every scope dimension it claims', () => {
    expect(SessionResource.scopes).toEqual(['organization']);
    expect(SessionResource.keys.organization).toBe('organizationId');
    expect(SessionResource.keys.id).toBe('id');
  });

  it('declares CRUD and no fifth verb', () => {
    // An `attach` action would live only in the token picker: a second, unofficial
    // vocabulary for something `update` plus `sessions:write` already says.
    expect(SessionResource.actions.map((action) => action.name)).toEqual([
      'read',
      'create',
      'update',
      'delete',
    ]);
  });

  it('is reachable by scoped credentials', () => {
    expect(SessionResource.credentialScope).toBe('sessions');
  });
});
