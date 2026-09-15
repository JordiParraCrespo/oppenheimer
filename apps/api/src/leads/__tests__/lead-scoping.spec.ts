import { type AccessScope, applyAccessScope, expectAbility } from '@oppenheimer/backend-authz';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { LeadResource } from '../leads.resource';

/**
 * The proof that the kernel does what the leads module claims.
 *
 * Two halves, because both have to hold and they fail independently:
 *
 *  - the **SQL predicate** decides which rows come back from a query;
 *  - the **CASL ability** decides what `can()` reports to a caller and to the
 *    UI.
 *
 * If only the first were tested, `can()` could lie about a lead the caller
 * cannot fetch. If only the second, the query could return rows the ability
 * would have refused. They are generated from the same declaration, and these
 * tests are what keep that true.
 */

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'rep-madrid',
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
    alias: 'lead',
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
  applyAccessScope(qb, LeadResource, callerScope);
  return qb.calls.map((call: { clause: string }) => call.clause);
}

/** How an admin would compose "this team sees its own leads" in the UI. */
const TEAM_SCOPED_READ: PermissionDefinition[] = [
  {
    action: 'read',
    subject: 'Lead',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated at build time
    conditions: { teamId: { $in: '${scope.teamIds}' } },
  },
];

describe('lead row scoping (SQL)', () => {
  it('always constrains the tenant', () => {
    const clauses = whereClausesFor(scope({ teamIds: ['team-madrid'] }));
    expect(clauses[0]).toBe('lead.organizationId = :authzOrganizationId');
  });

  it('narrows to the caller’s teams, their own leads, or an explicit grant', () => {
    const clauses = whereClausesFor(
      scope({
        teamIds: ['team-madrid'],
        grants: new Map([['Lead', new Set(['lead-x'])]]),
      }),
    );

    expect(clauses[1]).toBe(
      '(lead.teamId IN (:...authzTeamIds) OR lead.ownerId = :authzUserId OR lead.id IN (:...authzGrantIds))',
    );
  });

  it('returns nothing for a caller with no team, no leads and no grants', () => {
    // A resource declaring `own` always contributes an ownerId clause, so the
    // caller falls back to their own leads rather than the query going
    // unfiltered — and the tenant clause still stands in front of it.
    const clauses = whereClausesFor(scope());
    expect(clauses).toEqual([
      'lead.organizationId = :authzOrganizationId',
      '(lead.ownerId = :authzUserId)',
    ]);
  });

  it('drops every filter for a platform-tier caller', () => {
    expect(whereClausesFor(scope({ bypass: true }))).toEqual([]);
  });
});

describe('lead capabilities (CASL)', () => {
  const madrid = scope({ teamIds: ['team-madrid'] });

  it('lets a Madrid rep read a Madrid lead', () => {
    expectAbility(TEAM_SCOPED_READ, {
      user: { id: 'rep-madrid' },
      scope: madrid,
    }).canOn('read', 'Lead', { teamId: 'team-madrid' });
  });

  it('does not let a Madrid rep read a Barcelona lead', () => {
    // This is the motivating requirement, asserted at the ability layer so the
    // UI cannot show what the query would refuse.
    expectAbility(TEAM_SCOPED_READ, {
      user: { id: 'rep-madrid' },
      scope: madrid,
    }).cannotOn('read', 'Lead', { teamId: 'team-barcelona' });
  });

  it('grants nothing to a rep who belongs to no team', () => {
    expectAbility(TEAM_SCOPED_READ, {
      user: { id: 'new-hire' },
      scope: scope(),
    }).cannotOn('read', 'Lead', { teamId: 'team-madrid' });
  });

  it('scopes editing to the leads a rep owns', () => {
    expectAbility(
      [
        {
          action: 'update',
          subject: 'Lead',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated when the ability is built
          conditions: { ownerId: '${user.id}' },
        },
      ],
      { user: { id: 'rep-madrid' }, scope: madrid },
    )
      .canOn('update', 'Lead', { ownerId: 'rep-madrid' })
      .cannotOn('update', 'Lead', { ownerId: 'rep-barcelona' });
  });

  it('hides a field without hiding the record', () => {
    expectAbility(
      [
        { action: 'read', subject: 'Lead' },
        { action: 'read', subject: 'Lead', fields: ['value'], inverted: true },
      ],
      { user: { id: 'junior' }, scope: madrid },
    )
      .can('read', 'Lead')
      .can('read', 'Lead', 'notes')
      .cannot('read', 'Lead', 'value');
  });

  it('reaches a specific lead outside the caller’s team through an explicit grant', () => {
    const auditor = scope({
      userId: 'auditor',
      teamIds: [],
      grants: new Map([['Lead', new Set(['lead-42'])]]),
    });

    expectAbility(
      [
        {
          action: 'read',
          subject: 'Lead',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder interpolated when the ability is built
          conditions: { id: { $in: '${scope.grants.Lead}' } },
        },
      ],
      { user: { id: 'auditor' }, scope: auditor },
    )
      .canOn('read', 'Lead', { id: 'lead-42' })
      .cannotOn('read', 'Lead', { id: 'lead-43' });
  });
});

describe('the declaration itself', () => {
  it('names a column for every scope dimension it claims', () => {
    // defineResource enforces this at boot; asserting it here means a later
    // edit that drops a key fails in CI rather than at deploy.
    for (const dimension of LeadResource.scopes) {
      const key = (
        {
          organization: 'organization',
          team: 'team',
          own: 'owner',
          grant: 'id',
        } as const
      )[dimension];
      expect(LeadResource.keys[key]).toBeTruthy();
    }
  });

  it('is reachable by scoped credentials', () => {
    // Without a credentialScope the resource is invisible to API tokens and
    // MCP, which is a silent failure rather than a loud one.
    expect(LeadResource.credentialScope).toBe('leads');
  });
});
