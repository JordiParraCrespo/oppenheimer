import type { AccessScope } from '@oppenheimer/backend-authz';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AutomationRunMapper } from '../automation-run.mapper';
import { AutomationResource } from '../automations.resource';
import type { AutomationRunOrmEntity } from '../database/automation-run.orm-entity';
import { AutomationRunRepository, runTenantPredicate } from '../database/automation-run.repository';

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'user-1',
    organizationId: 'org-1',
    teamIds: [],
    grants: new Map(),
    bypass: false,
    ...overrides,
  } as AccessScope;
}

describe('the runs list tenant predicate', () => {
  it('restates applyAccessScope for an organization-only resource — and the resource is one', () => {
    // runTenantPredicate is right only for this shape. If the resource gains a
    // team, own or grant dimension, go back to applyAccessScope.
    expect(AutomationResource.scopes).toEqual(['organization']);
    expect(AutomationResource.keys.organization).toBe('organizationId');
  });

  it("narrows to the caller's workspace, on the run itself", () => {
    expect(runTenantPredicate(scope(), 3)).toEqual({
      clause: 'run."organizationId" = $3',
      values: ['org-1'],
    });
  });

  it('adds nothing for a bypass scope', () => {
    expect(runTenantPredicate(scope({ bypass: true, organizationId: null }), 2)).toBeNull();
  });

  it('fails closed for a scope with no workspace', () => {
    expect(runTenantPredicate(scope({ organizationId: null }), 2)).toEqual({
      clause: 'FALSE',
      values: [],
    });
  });
});

describe('the runs page', () => {
  function repository(grouped: { status: string; count: string }[]) {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'run-1' }])
      .mockResolvedValueOnce(grouped);
    const runs = new AutomationRunRepository(
      {} as Repository<AutomationRunOrmEntity>,
      { query } as unknown as DataSource,
      {} as OutboxService,
      { readModelOf: (row: unknown) => row } as unknown as AutomationRunMapper,
    );
    return { runs, query };
  }

  const grouped = [
    { status: 'queued', count: '1' },
    { status: 'running', count: '2' },
    { status: 'completed', count: '5' },
    { status: 'failed', count: '3' },
    { status: 'cancelled', count: '4' },
    { status: 'skipped', count: '7' },
    { status: 'expired', count: '6' },
  ];
  const since = new Date('2026-08-28T10:00:00Z');

  it('reads the page and every count in two statements, bounded by the window and the tenant', async () => {
    const { runs, query } = repository(grouped);
    const page = await runs.page(scope(), { since }, 2, 10);
    expect(query).toHaveBeenCalledTimes(2);
    const [rowsSql, rowsValues] = query.mock.calls[0];
    expect(rowsSql).toContain('run."createdAt" >= $1 AND run."organizationId" = $2');
    expect(rowsSql).not.toContain(' IN (SELECT');
    expect(rowsValues.slice(0, 2)).toEqual([since, 'org-1']);
    expect(rowsValues.slice(-2)).toEqual([10, 10]);
    const [countsSql, countsValues] = query.mock.calls[1];
    expect(countsSql).toContain('GROUP BY "status"');
    expect(countsValues).toEqual([since, 'org-1']);
    expect(page.items).toEqual([{ id: 'run-1' }]);
  });

  it('totals the requested statuses and counts the listed ones, from one grouping', async () => {
    const { runs } = repository(grouped);
    const listed = await runs.page(scope(), { since }, 1, 10);
    expect(listed.total).toBe(1 + 2 + 5 + 3 + 4);
    expect(listed.counts).toEqual({ all: 15, completed: 5, failed: 3, running: 3 });

    const skipped = await repository(grouped).runs.page(
      scope(),
      { since, statuses: ['skipped', 'skipped'] },
      1,
      10,
    );
    expect(skipped.total).toBe(7);
    expect(skipped.counts.all).toBe(15);
  });
});
