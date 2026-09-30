import type { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { InboundEventOrmEntity } from '../database/inbound-event.orm-entity';
import { InboundEventRepository } from '../database/inbound-event.repository';
import type { InboundEventMapper } from '../inbound-event.mapper';

/**
 * The same shape trap as the automation sweep: TypeORM answers an
 * `UPDATE … RETURNING` with `[rows, affected]`. Read as rows, this sweep staged jobs
 * with `inboundDeliveryId: undefined` and never restaged a delivery whose retries ran
 * out. The harness answers in the driver's shape, telling the two statements apart by
 * the table each one updates.
 */
function harness(
  abandoned: { id: string }[],
  due: { id: string; source: string; deliveryId: string }[],
) {
  const staged: { queue: string; jobName: string; payload: Record<string, unknown> }[] = [];
  const manager = {
    query: async (sql: string) => {
      if (!/^\s*UPDATE/i.test(sql)) throw new Error(`unexpected statement: ${sql}`);
      // The abandon pass updates the table by name; the restage pass aliases
      // it as `d` and is the only one that carries a FROM.
      const rows = /FROM \(SELECT/i.test(sql) ? due : abandoned;
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
  const repository = new InboundEventRepository(
    {} as DataSource,
    {} as Repository<InboundEventOrmEntity>,
    outbox,
    {} as InboundEventMapper,
  );
  return { repository, staged };
}

const stale = new Date('2026-09-29T17:00:00Z');
const abandonAfter = new Date('2026-09-28T17:00:00Z');

describe('InboundEventRepository.restageUnprocessed', () => {
  it('stages one job per unprocessed delivery and counts what it abandoned', async () => {
    const { repository, staged } = harness(
      [{ id: 'delivery-old' }],
      [{ id: 'delivery-1', source: 'github', deliveryId: 'gh-1' }],
    );

    const result = await repository.restageUnprocessed(stale, abandonAfter, 500);

    expect(result).toEqual({ restaged: 1, abandoned: 1 });
    expect(staged).toEqual([
      {
        queue: QUEUE_NAMES.INBOUND_EVENTS,
        jobName: 'process',
        payload: { inboundDeliveryId: 'delivery-1' },
      },
    ]);
  });

  it('stages nothing and counts nothing on a quiet sweep', async () => {
    const { repository, staged } = harness([], []);

    expect(await repository.restageUnprocessed(stale, abandonAfter, 500)).toEqual({
      restaged: 0,
      abandoned: 0,
    });
    expect(staged).toEqual([]);
  });
});
