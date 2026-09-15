import { describe, expect, it } from 'vitest';
import { defineResource } from '../registry/resource-definition';
import type { AccessScope } from './access-scope';
import { applyAccessScope } from './apply-access-scope';

/**
 * A stand-in for TypeORM's `SelectQueryBuilder` that records the clauses it was
 * handed. The unit under test only ever calls `andWhere`, so exercising it
 * against a fake keeps these tests free of a database while still asserting the
 * exact SQL fragments and parameters produced.
 */
function fakeQueryBuilder(alias = 'lead') {
  const calls: { clause: string; parameters?: Record<string, unknown> }[] = [];
  const qb = {
    alias,
    andWhere(clause: string, parameters?: Record<string, unknown>) {
      calls.push({ clause, parameters });
      return qb;
    },
    calls,
  };
  // biome-ignore lint/suspicious/noExplicitAny: a structural test double for the query builder
  return qb as any;
}

const TeamScoped = defineResource({
  subject: 'Lead',
  label: 'Leads',
  group: 'crm',
  actions: [{ name: 'read' }],
  keys: {
    organization: 'organizationId',
    team: 'teamId',
    owner: 'ownerId',
    id: 'id',
  },
  scopes: ['organization', 'team', 'own', 'grant'],
});

const OrgOnly = defineResource({
  subject: 'Invoice',
  label: 'Invoices',
  group: 'billing',
  actions: [{ name: 'read' }],
  keys: { organization: 'organizationId' },
  scopes: ['organization'],
});

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'user-1',
    organizationId: 'org-1',
    teamIds: [],
    grants: new Map(),
    bypass: false,
    ...overrides,
  };
}

describe('applyAccessScope', () => {
  it('leaves the query untouched for a bypass scope', () => {
    const qb = fakeQueryBuilder();
    applyAccessScope(qb, TeamScoped, scope({ bypass: true }));
    expect(qb.calls).toHaveLength(0);
  });

  it('always constrains the tenant, conjunctively', () => {
    const qb = fakeQueryBuilder();
    applyAccessScope(qb, TeamScoped, scope({ teamIds: ['team-a'] }));

    expect(qb.calls[0].clause).toBe('lead.organizationId = :authzOrganizationId');
    expect(qb.calls[0].parameters).toEqual({ authzOrganizationId: 'org-1' });
  });

  it('ORs the narrowing dimensions together', () => {
    const qb = fakeQueryBuilder();
    applyAccessScope(
      qb,
      TeamScoped,
      scope({
        teamIds: ['team-a', 'team-b'],
        grants: new Map([['Lead', new Set(['lead-9'])]]),
      }),
    );

    const [, narrowing] = qb.calls;
    expect(narrowing.clause).toBe(
      '(lead.teamId IN (:...authzTeamIds) OR lead.ownerId = :authzUserId OR lead.id IN (:...authzGrantIds))',
    );
    expect(narrowing.parameters).toEqual({
      authzTeamIds: ['team-a', 'team-b'],
      authzUserId: 'user-1',
      authzGrantIds: ['lead-9'],
    });
  });

  it("skips narrowing entirely for an 'all' grant", () => {
    const qb = fakeQueryBuilder();
    applyAccessScope(qb, TeamScoped, scope({ grants: new Map([['Lead', 'all']]) }));

    // Tenant clause only — the grant already covers every row inside it.
    expect(qb.calls).toHaveLength(1);
    expect(qb.calls[0].clause).toContain('organizationId');
  });

  it('requires no narrowing clause for an organization-only resource', () => {
    const qb = fakeQueryBuilder('invoice');
    applyAccessScope(qb, OrgOnly, scope());

    expect(qb.calls).toHaveLength(1);
    expect(qb.calls[0].clause).toBe('invoice.organizationId = :authzOrganizationId');
  });

  it('fails closed when no dimension yields a clause', () => {
    // The caller is in no team and holds no grants. A resource without an
    // `own` key would leave nothing to match — that must mean "no rows", never
    // "every row".
    const noOwner = defineResource({
      subject: 'Report',
      label: 'Reports',
      group: 'crm',
      actions: [{ name: 'read' }],
      keys: { organization: 'organizationId', team: 'teamId' },
      scopes: ['organization', 'team'],
    });

    const qb = fakeQueryBuilder('report');
    applyAccessScope(qb, noOwner, scope({ teamIds: [] }));

    expect(qb.calls.at(-1)?.clause).toBe('1 = 0');
  });

  it('fails closed when the caller has no active organization', () => {
    const qb = fakeQueryBuilder();
    applyAccessScope(qb, TeamScoped, scope({ organizationId: null, teamIds: ['team-a'] }));

    expect(qb.calls).toHaveLength(1);
    expect(qb.calls[0].clause).toBe('1 = 0');
  });
});

describe('defineResource', () => {
  it('rejects a scope dimension with no column to filter on', () => {
    expect(() =>
      defineResource({
        subject: 'Broken',
        label: 'Broken',
        group: 'crm',
        actions: [{ name: 'read' }],
        keys: { organization: 'organizationId' },
        scopes: ['organization', 'team'],
      }),
    ).toThrow(/keys.team/);
  });

  it('rejects a duplicate action', () => {
    expect(() =>
      defineResource({
        subject: 'Dupe',
        label: 'Dupe',
        group: 'crm',
        actions: [{ name: 'read' }, { name: 'read' }],
        keys: { organization: 'organizationId' },
        scopes: ['organization'],
      }),
    ).toThrow(/twice/);
  });

  it('defaults the id key so grant scoping works without repeating it', () => {
    const resource = defineResource({
      subject: 'Thing',
      label: 'Thing',
      group: 'crm',
      actions: [{ name: 'read' }],
      keys: { organization: 'organizationId' },
      scopes: ['organization', 'grant'],
    });

    expect(resource.keys.id).toBe('id');
  });
});
