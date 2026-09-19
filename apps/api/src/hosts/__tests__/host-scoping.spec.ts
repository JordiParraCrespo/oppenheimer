import { type AccessScope, applyAccessScope, expectAbility } from '@oppenheimer/backend-authz';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { HostPairingTokenResource } from '../host-pairing-token.resource';
import { HostResource } from '../hosts.resource';

/**
 * A host is person-owned, and this is the proof that the kernel treats it that
 * way.
 *
 * The interesting assertion is a **negative** one: there is no tenant clause.
 * `applyAccessScope` writes one for every resource that declares an organization
 * key, and `host` deliberately has no such column — one laptop is paired once and
 * every workspace its owner is in borrows it. If a later edit gave the resource
 * an organization key, the same laptop would become invisible from the second
 * workspace, and the first test below is what fails.
 *
 * Both halves are covered because both have to hold and they fail
 * independently: the **SQL predicate** decides which rows a query returns, and
 * the **CASL ability** decides what `can()` reports to a caller and to the UI.
 */

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'jordi',
    organizationId: 'org-personal',
    teamIds: [],
    grants: new Map(),
    bypass: false,
    ...overrides,
  };
}

/** Records the clauses a query would carry, without needing a database. */
function fakeQueryBuilder(alias: string) {
  const calls: { clause: string; parameters?: Record<string, unknown> }[] = [];
  const qb = {
    alias,
    andWhere(clause: string, parameters?: Record<string, unknown>) {
      calls.push({ clause, parameters });
      return qb;
    },
    calls,
  };
  // biome-ignore lint/suspicious/noExplicitAny: structural double for the query builder
  return qb as any;
}

function whereClausesFor(
  callerScope: AccessScope,
  resource = HostResource,
  alias = 'host',
): string[] {
  const qb = fakeQueryBuilder(alias);
  applyAccessScope(qb, resource, callerScope);
  return qb.calls.map((call: { clause: string }) => call.clause);
}

/** How the `user` system role grants a person their own machines. */
const OWN_HOSTS: PermissionDefinition[] = [
  {
    action: 'manage',
    subject: 'Host',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated when the ability is built
    conditions: { ownerUserId: '${user.id}' },
  },
];

describe('host row scoping (SQL)', () => {
  it('never constrains a tenant, because a host has no workspace', () => {
    const clauses = whereClausesFor(scope());

    expect(clauses).toEqual(['(host.ownerUserId = :authzUserId)']);
    expect(clauses.some((clause) => clause.includes('organizationId'))).toBe(false);
  });

  it('widens to an explicitly granted host beside the caller’s own', () => {
    const clauses = whereClausesFor(
      scope({ grants: new Map([['Host', new Set(['host-shared'])]]) }),
    );

    // Sharing a machine with a teammate is an `access_grant` over `Host`, which
    // is the only reason a second person sees one.
    expect(clauses).toEqual([
      '(host.ownerUserId = :authzUserId OR host.id IN (:...authzGrantIds))',
    ]);
  });

  it('returns nothing to a stranger', () => {
    // A caller who owns no host and holds no grant still gets a predicate, and it
    // is unsatisfiable rather than absent: the failure mode of a missing clause
    // is "every host in the deployment".
    const clauses = whereClausesFor(scope({ userId: 'stranger' }));

    expect(clauses).toEqual(['(host.ownerUserId = :authzUserId)']);
    const parameters = (() => {
      const qb = fakeQueryBuilder('host');
      applyAccessScope(qb, HostResource, scope({ userId: 'stranger' }));
      return qb.calls[0].parameters;
    })();
    expect(parameters).toEqual({ authzUserId: 'stranger' });
  });

  it('drops every filter for a platform-tier caller', () => {
    expect(whereClausesFor(scope({ bypass: true }))).toEqual([]);
  });
});

describe('pairing token row scoping (SQL)', () => {
  it('scopes a token to whoever minted it, and to nothing else', () => {
    const clauses = whereClausesFor(scope(), HostPairingTokenResource, 'token');

    expect(clauses).toEqual(['(token.createdByUserId = :authzUserId)']);
  });

  it('cannot be reached by a grant, because a token is not shareable', () => {
    const clauses = whereClausesFor(
      scope({ grants: new Map([['HostPairingToken', new Set(['token-1'])]]) }),
      HostPairingTokenResource,
      'token',
    );

    expect(clauses).toEqual(['(token.createdByUserId = :authzUserId)']);
  });
});

describe('host capabilities (CASL)', () => {
  it('lets a person manage their own machine', () => {
    expectAbility(OWN_HOSTS, { user: { id: 'jordi' }, scope: scope() })
      .canOn('read', 'Host', { ownerUserId: 'jordi' })
      .canOn('update', 'Host', { ownerUserId: 'jordi' })
      .canOn('delete', 'Host', { ownerUserId: 'jordi' });
  });

  it('does not let them touch somebody else’s', () => {
    // The ability has to refuse it too, or the UI would offer a button the
    // scoped query then reports as a missing host.
    expectAbility(OWN_HOSTS, { user: { id: 'jordi' }, scope: scope() }).cannotOn('update', 'Host', {
      ownerUserId: 'alex',
    });
  });

  it('reaches a shared machine through an explicit grant', () => {
    const teammate = scope({
      userId: 'alex',
      grants: new Map([['Host', new Set(['host-shared'])]]),
    });

    expectAbility(
      [
        {
          action: 'read',
          subject: 'Host',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated when the ability is built
          conditions: { id: { $in: '${scope.grants.Host}' } },
        },
      ],
      { user: { id: 'alex' }, scope: teammate },
    )
      .canOn('read', 'Host', { id: 'host-shared' })
      .cannotOn('read', 'Host', { id: 'host-private' });
  });
});

describe('the declarations themselves', () => {
  it('names a column for every scope dimension the host claims', () => {
    // `defineResource` enforces this at boot; asserting it here means an edit
    // that drops a key fails in CI rather than at deploy.
    for (const dimension of HostResource.scopes) {
      const key = (
        { organization: 'organization', team: 'team', own: 'owner', grant: 'id' } as const
      )[dimension];
      expect(HostResource.keys[key]).toBeTruthy();
    }
  });

  it('declares no organization key at all', () => {
    expect(HostResource.keys.organization).toBeUndefined();
    expect(HostResource.scopes).not.toContain('organization');
  });

  it('is reachable by scoped credentials', () => {
    // Without a credentialScope the resource is invisible to API tokens and MCP,
    // which is a silent failure rather than a loud one.
    expect(HostResource.credentialScope).toBe('hosts');
  });

  it('keeps the pairing token out of the credential catalog', () => {
    // Pairing routes are authorized as `Host`; the token's declaration exists to
    // scope rows, and giving it a credential scope would publish a second noun
    // no policy names.
    expect(HostPairingTokenResource.credentialScope).toBeUndefined();
    expect(HostPairingTokenResource.scopes).toEqual(['own']);
  });
});
