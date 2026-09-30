import { type AccessScope, applyAccessScope } from '@oppenheimer/backend-authz';
import {
  canAccess,
  defineAbilitiesFromPermissions,
  SYSTEM_ROLE_PERMISSIONS,
} from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { InstallationResource } from '../github.resource';

/**
 * The proof that the kernel does what the github module claims.
 *
 * Two halves, because both have to hold and they fail independently: the **SQL
 * predicate** decides which rows come back from a query, and the **CASL
 * ability** decides what `can()` reports to a caller and to the UI. The first
 * comes from `InstallationResource`, the second from the owner role's rule in
 * `SYSTEM_ROLE_PERMISSIONS`; the generic branches of both (bypass, no tenant)
 * are proved once, in `@oppenheimer/backend-authz` and `@oppenheimer/shared`.
 *
 * What an installation grants is one hour of write access to someone's source,
 * so the interesting assertion is the negative one: a workspace cannot reach a
 * row another workspace claimed, at either layer.
 */

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'ana',
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
    alias: 'installation',
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
  applyAccessScope(qb, InstallationResource, callerScope);
  return qb.calls.map((call: { clause: string }) => call.clause);
}

/** The owner role's rules, as the catalog seeds them into the `role` table. */
const OWNER = SYSTEM_ROLE_PERMISSIONS.owner;

describe('installation row scoping (SQL)', () => {
  it('constrains the tenant, and nothing else, whatever else the caller holds', () => {
    // No team, own or grant dimension is declared: an installation is what the
    // *workspace* was granted, so narrowing it further would hide a connection
    // from the colleague who has to use it.
    const clauses = whereClausesFor(
      scope({ teamIds: ['team-madrid'], grants: new Map([['Project', new Set(['project-x'])]]) }),
    );
    expect(clauses).toEqual(['installation.organizationId = :authzOrganizationId']);
  });
});

describe('installation capabilities (CASL)', () => {
  /**
   * The owner rule built the way `AbilityFactory` builds it for a request: the
   * `${activeOrganizationId}` placeholder is what narrows a workspace role to
   * the workspace that is actually selected. Reaching another workspace's row
   * is an hour of write access to someone else's repositories.
   */
  it.each([
    ['reads its own workspace’s installation', 'org-acme', 'org-acme', true],
    ['cannot reach another workspace’s installation', 'org-acme', 'org-rival', false],
    ['gets nothing with no active workspace', null, 'org-acme', false],
  ] as const)('an owner %s', (_case, activeOrganizationId, rowOrganizationId, allowed) => {
    const ability = defineAbilitiesFromPermissions(OWNER, {
      user: { id: 'ana' },
      activeOrganizationId,
    });
    expect(canAccess(ability, 'read', 'Installation', { organizationId: rowOrganizationId })).toBe(
      allowed,
    );
  });
});

describe('the declaration itself', () => {
  it('is reachable by scoped credentials under the repositories group', () => {
    // Without a credentialScope the resource is invisible to API tokens and
    // MCP, which is a silent failure rather than a loud one. The group is named
    // for what a caller asks for, not for the vendor.
    expect(InstallationResource.credentialScope).toBe('repositories');
  });
});
