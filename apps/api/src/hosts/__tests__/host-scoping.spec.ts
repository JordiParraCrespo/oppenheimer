import { type AccessScope, applyAccessScope, expectAbility } from '@oppenheimer/backend-authz';
import { SYSTEM_ROLE_PERMISSIONS } from '@oppenheimer/shared';
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

function whereClausesFor(callerScope: AccessScope): string[] {
  const qb = fakeQueryBuilder('host');
  applyAccessScope(qb, HostResource, callerScope);
  return qb.calls.map((call: { clause: string }) => call.clause);
}

/** The seeded `user` role, which is where a person's own machines are granted. */
const USER_ROLE = SYSTEM_ROLE_PERMISSIONS.user;

describe('host row scoping (SQL)', () => {
  it('gives a caller with no host and no grant an owner predicate that matches nothing', () => {
    // The predicate is unsatisfiable rather than absent: the failure mode of a
    // missing clause is "every host in the deployment". The exact call list is
    // also the no-tenant lock: a host has no workspace, so an organization
    // clause here is a regression.
    const qb = fakeQueryBuilder('host');
    applyAccessScope(qb, HostResource, scope({ userId: 'stranger' }));

    expect(qb.calls).toEqual([
      { clause: '(host.ownerUserId = :authzUserId)', parameters: { authzUserId: 'stranger' } },
    ]);
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
});

describe('host capabilities (CASL)', () => {
  it('lets a person manage their own machine', () => {
    expectAbility(USER_ROLE, { user: { id: 'jordi' }, scope: scope() })
      .canOn('read', 'Host', { ownerUserId: 'jordi' })
      .canOn('update', 'Host', { ownerUserId: 'jordi' })
      .canOn('delete', 'Host', { ownerUserId: 'jordi' });
  });

  it('does not let them touch somebody else’s', () => {
    // The ability has to refuse it too, or the UI would offer a button the
    // scoped query then reports as a missing host.
    expectAbility(USER_ROLE, { user: { id: 'jordi' }, scope: scope() }).cannotOn('update', 'Host', {
      ownerUserId: 'alex',
    });
  });
});
