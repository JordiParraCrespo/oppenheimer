import type { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { AutomationRunMapper } from '../automation-run.mapper';
import type { AutomationRunOrmEntity } from '../database/automation-run.orm-entity';
import { AutomationRunRepository } from '../database/automation-run.repository';

/**
 * The sweep reads an `UPDATE … RETURNING`, and TypeORM does not hand those
 * back the way it hands back a `SELECT`: `PostgresQueryRunner.query` answers
 * `[rows, affected]` for `UPDATE` and `DELETE`, and the rows alone for
 * everything else. Read as rows, the sweep looped over an array and a number,
 * staged two jobs carrying `runId: undefined` on every tick — which the
 * processor logged as an unknown job and dropped — and never re-dispatched a
 * single run that was actually due.
 *
 * So the harness answers in the driver's shape rather than the convenient
 * one; a sweep written against the convenient shape fails here.
 */
function harness(rows: { id: string; automationId: string; cause: string }[]) {
  const staged: { queue: string; jobName: string; payload: Record<string, unknown> }[] = [];
  const manager = {
    query: async (sql: string) => {
      if (!/^\s*UPDATE/i.test(sql)) throw new Error(`unexpected statement: ${sql}`);
      return [rows, rows.length];
    },
  } as unknown as EntityManager;
  const outbox = {
    transaction: <T>(work: (manager: EntityManager) => Promise<T>) => work(manager),
    stageJob: async (
      _manager: EntityManager,
      params: { queue: string; jobName: string; payload: Record<string, unknown> },
    ) => {
      staged.push({ queue: params.queue, jobName: params.jobName, payload: params.payload });
    },
  } as unknown as OutboxService;
  const repository = new AutomationRunRepository(
    {} as Repository<AutomationRunOrmEntity>,
    {} as DataSource,
    outbox,
    {} as AutomationRunMapper,
  );
  return { repository, staged };
}

const due = [
  { id: 'run-1', automationId: 'automation-1', cause: 'schedule' },
  { id: 'run-2', automationId: 'automation-2', cause: 'event' },
];

describe('AutomationRunRepository.restageStalled', () => {
  it('stages one dispatch per run that was due, carrying its id', async () => {
    const { repository, staged } = harness(due);

    const restaged = await repository.restageStalled(new Date('2026-09-29T17:00:00Z'), 100);

    expect(restaged).toBe(2);
    expect(staged).toEqual([
      {
        queue: QUEUE_NAMES.AUTOMATION_RUNS,
        jobName: 'dispatch',
        payload: { runId: 'run-1' },
      },
      {
        queue: QUEUE_NAMES.AUTOMATION_RUNS,
        jobName: 'dispatch',
        payload: { runId: 'run-2' },
      },
    ]);
  });

  it('stages nothing when no run was due', async () => {
    const { repository, staged } = harness([]);

    expect(await repository.restageStalled(new Date('2026-09-29T17:00:00Z'), 100)).toBe(0);
    expect(staged).toEqual([]);
  });
});
