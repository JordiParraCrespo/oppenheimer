import { type AccessScope, applyAccessScope } from '@oppenheimer/backend-authz';
import {
  canAccess,
  defineAbilitiesFromPermissions,
  type PermissionDefinition,
} from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { InstallationResource } from '../github.resource';

/**
 * The proof that the kernel does what the github module claims.
 *
 * Two halves, because both have to hold and they fail independently: the **SQL
 * predicate** decides which rows come back from a query, and the **CASL
 * ability** decides what `can()` reports to a caller and to the UI. They are
 * generated from the same declaration, and these tests are what keep that true.
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

/** What the org-scoped `owner` role carries for this subject. */
const WORKSPACE_INSTALLATIONS: PermissionDefinition[] = [
  {
    action: 'manage',
    subject: 'Installation',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated when the ability is built
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

describe('installation row scoping (SQL)', () => {
  it('constrains the tenant, and nothing else', () => {
    // No team, own or grant dimension is declared: an installation is what the
    // *workspace* was granted, so narrowing it further would hide a connection
    // from the colleague who has to use it.
    expect(whereClausesFor(scope())).toEqual([
      'installation.organizationId = :authzOrganizationId',
    ]);
  });

  it('constrains the tenant even for a caller with grants elsewhere', () => {
    const clauses = whereClausesFor(
      scope({ teamIds: ['team-madrid'], grants: new Map([['Lead', new Set(['lead-x'])]]) }),
    );
    expect(clauses).toEqual(['installation.organizationId = :authzOrganizationId']);
  });

  it('drops every filter for a platform-tier caller', () => {
    expect(whereClausesFor(scope({ bypass: true }))).toEqual([]);
  });
});

describe('installation capabilities (CASL)', () => {
  /**
   * Built the way `AbilityFactory` builds it for a request: the
   * `${activeOrganizationId}` placeholder is what narrows a workspace role to
   * the workspace that is actually selected.
   */
  function abilityFor(activeOrganizationId: string | null) {
    return defineAbilitiesFromPermissions(WORKSPACE_INSTALLATIONS, {
      user: { id: 'ana' },
      activeOrganizationId,
    });
  }

  it('lets a member of the workspace read its installations', () => {
    expect(
      canAccess(abilityFor('org-acme'), 'read', 'Installation', { organizationId: 'org-acme' }),
    ).toBe(true);
  });

  it('does not let one workspace reach another workspace’s installation', () => {
    // This is the motivating requirement: reaching that row is an hour of write
    // access to someone else's repositories.
    expect(
      canAccess(abilityFor('org-acme'), 'read', 'Installation', { organizationId: 'org-rival' }),
    ).toBe(false);
  });

  it('grants nothing to an account with no active workspace', () => {
    expect(
      canAccess(abilityFor(null), 'read', 'Installation', { organizationId: 'org-acme' }),
    ).toBe(false);
  });
});

describe('the declaration itself', () => {
  it('names a column for every scope dimension it claims', () => {
    // defineResource enforces this at boot; asserting it here means a later edit
    // that drops a key fails in CI rather than at deploy.
    for (const dimension of InstallationResource.scopes) {
      const key = (
        { organization: 'organization', team: 'team', own: 'owner', grant: 'id' } as const
      )[dimension];
      expect(InstallationResource.keys[key]).toBeTruthy();
    }
  });

  it('is reachable by scoped credentials under the repositories group', () => {
    // Without a credentialScope the resource is invisible to API tokens and
    // MCP, which is a silent failure rather than a loud one. The group is named
    // for what a caller asks for, not for the vendor.
    expect(InstallationResource.credentialScope).toBe('repositories');
  });

  it('declares no repository subject of its own', () => {
    // There is no repository row anywhere, so there is nothing an instance-level
    // check could be made against; the listing routes sit on `read Installation`,
    // which is the access GitHub is about to be asked to honour.
    expect(InstallationResource.subject).toBe('Installation');
  });
});
