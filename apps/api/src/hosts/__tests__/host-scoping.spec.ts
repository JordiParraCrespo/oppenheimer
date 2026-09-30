import { type AccessScope, applyAccessScope, expectAbility } from '@oppenheimer/backend-authz';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { HostResource } from '../hosts.resource';

/**
 * A host is person-owned (see `hosts.resource.ts`). The key assertion is a
 * **negative** one: no tenant clause. Give the resource an organization key and the
 * same laptop vanishes from its owner's second workspace; the first test fails.
 * The SQL predicate and the CASL ability fail independently, so both are tested.
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
  it('is the same predicate on the same column, because it is the same resource', () => {
    expect(whereClausesFor(scope(), HostResource, 'token')).toEqual([
      '(token.ownerUserId = :authzUserId)',
    ]);
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
    // `defineResource` enforces this at boot; this fails in CI instead.
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
    expect(HostResource.credentialScope).toBe('hosts');
  });

  it('is the only resource this module declares', () => {
    // Pairing tokens are scoped by it too. One noun, one row predicate, one set
    // of verbs in the role builder.
    expect(HostResource.subject).toBe('Host');
    expect(HostResource.actions.map((action) => action.name)).toEqual([
      'read',
      'create',
      'update',
      'delete',
    ]);
  });
});
