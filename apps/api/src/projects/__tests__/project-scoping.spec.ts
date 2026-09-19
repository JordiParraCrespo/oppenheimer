import { type AccessScope, applyAccessScope, expectAbility } from '@oppenheimer/backend-authz';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { ProjectResource } from '../projects.resource';

/**
 * The proof that a project is workspace-owned and nothing more.
 *
 * Two halves, because both have to hold and they fail independently: the SQL
 * predicate decides which rows a query returns, the CASL ability decides what
 * `can()` reports to a caller and to the console. They are generated from the
 * same declaration, and these tests are what keep that true.
 *
 * The interesting case for this resource is the *absence* of narrowing: a
 * project declares no team, own or grant dimension, so every member of the
 * workspace sees all of them — and `applyAccessScope` must not then fall back
 * to an unfiltered query.
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

/**
 * What the org-scoped `owner` role holds over projects. The stored rule writes
 * the tenant as `${activeOrganizationId}`; interpolating it from the resolved
 * scope here asserts the same thing through the scope this module's queries use.
 */
const WORKSPACE_PROJECTS: PermissionDefinition[] = [
  {
    action: 'manage',
    subject: 'Project',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated when the ability is built
    conditions: { organizationId: '${scope.organizationId}' },
  },
];

describe('project row scoping (SQL)', () => {
  it('constrains the tenant, and that is the whole predicate', () => {
    expect(whereClausesFor(scope({ teamIds: ['team-madrid'] }))).toEqual([
      'project.organizationId = :authzOrganizationId',
    ]);
  });

  it('ignores teams and grants, because the declaration claims neither', () => {
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

  it('returns nothing for a caller with no active workspace', () => {
    // Fails closed rather than unfiltered: with no tenant there is no project
    // this caller may see, and an empty predicate would be every project.
    expect(whereClausesFor(scope({ organizationId: null }))).toEqual(['1 = 0']);
  });

  it('drops every filter for a platform-tier caller', () => {
    expect(whereClausesFor(scope({ bypass: true }))).toEqual([]);
  });
});

describe('project capabilities (CASL)', () => {
  it('lets a workspace member manage the projects of their own workspace', () => {
    expectAbility(WORKSPACE_PROJECTS, { user: { id: 'member-1' }, scope: scope() })
      .canOn('read', 'Project', { organizationId: 'org-acme' })
      .canOn('update', 'Project', { organizationId: 'org-acme' });
  });

  it('does not let them reach another workspace’s project', () => {
    expectAbility(WORKSPACE_PROJECTS, {
      user: { id: 'member-1' },
      scope: scope(),
    }).cannotOn('read', 'Project', { organizationId: 'org-other' });
  });

  it('gives a caller with no active workspace nothing', () => {
    expectAbility(WORKSPACE_PROJECTS, {
      user: { id: 'member-1' },
      scope: scope({ organizationId: null }),
    }).cannotOn('read', 'Project', { organizationId: 'org-acme' });
  });
});

describe('the declaration itself', () => {
  it('names a column for every scope dimension it claims', () => {
    // defineResource enforces this at boot; asserting it here means a later
    // edit that drops a key fails in CI rather than at deploy.
    expect(ProjectResource.scopes).toEqual(['organization']);
    expect(ProjectResource.keys.organization).toBe('organizationId');
    expect(ProjectResource.keys.id).toBe('id');
  });

  it('declares only the actions a route or a credential can exercise', () => {
    // No `create`: a project is created by the first session that needs one,
    // through a port inside the process, so a `create Project` permission would
    // appear in every role builder and token scope with nothing behind it.
    expect(ProjectResource.actions.map((action) => action.name)).toEqual(['read', 'update']);
  });

  it('is reachable by scoped credentials', () => {
    // Without a credentialScope the resource is invisible to API tokens and
    // MCP, which is a silent failure rather than a loud one.
    expect(ProjectResource.credentialScope).toBe('projects');
  });
});
