import { type AccessScope, applyAccessScope } from '@oppenheimer/backend-authz';
import {
  canAccess,
  defineAbilitiesFromPermissions,
  SYSTEM_ROLE_PERMISSIONS,
} from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { ProjectResource } from '../projects.resource';

/**
 * The proof that a project is workspace-owned and nothing more.
 *
 * Two halves, because both have to hold and they fail independently: the SQL
 * predicate decides which rows a query returns, the CASL ability decides what
 * `can()` reports to a caller and to the console. The first comes from
 * `ProjectResource`, the second from the owner role's rule in
 * `SYSTEM_ROLE_PERMISSIONS`; the generic branches of both (bypass, no tenant)
 * are proved once, in `@oppenheimer/backend-authz` and `@oppenheimer/shared`.
 *
 * The interesting case for this resource is the *absence* of narrowing: a
 * project declares no team, own or grant dimension, so every member of the
 * workspace sees all of them.
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
    alias: 'project',
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
  applyAccessScope(qb, ProjectResource, callerScope);
  return qb.calls.map((call: { clause: string }) => call.clause);
}

/** The owner role's rules, as the catalog seeds them into the `role` table. */
const OWNER = SYSTEM_ROLE_PERMISSIONS.owner;

describe('project row scoping (SQL)', () => {
  it('constrains the tenant, and ignores teams and grants the declaration never claims', () => {
    // A `Project` grant would be a row nobody writes; asserting it changes
    // nothing keeps a later `scopes` edit from silently widening a listing.
    const clauses = whereClausesFor(
      scope({
        teamIds: ['team-madrid'],
        grants: new Map([['Project', new Set(['project-x'])]]),
      }),
    );

    expect(clauses).toEqual(['project.organizationId = :authzOrganizationId']);
  });
});

describe('project capabilities (CASL)', () => {
  // The owner rule stores the tenant as `${activeOrganizationId}`, the way
  // `AbilityFactory` interpolates it for a request.
  it.each([
    ['manages its own workspace’s project', 'org-acme', 'org-acme', true],
    ['cannot reach another workspace’s project', 'org-acme', 'org-other', false],
    ['gets nothing with no active workspace', null, 'org-acme', false],
  ] as const)('an owner %s', (_case, activeOrganizationId, rowOrganizationId, allowed) => {
    const ability = defineAbilitiesFromPermissions(OWNER, {
      user: { id: 'member-1' },
      activeOrganizationId,
    });
    for (const action of ['read', 'update'] as const) {
      expect(canAccess(ability, action, 'Project', { organizationId: rowOrganizationId })).toBe(
        allowed,
      );
    }
  });
});
