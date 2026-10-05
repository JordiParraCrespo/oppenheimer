import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { configDefaults, configStub } from '../../config/__tests__/config-stub';
import { OutboxRetentionProcessor } from '../infrastructure/outbox-retention.processor';

const { retention } = configDefaults();
const OUTBOX_RETENTION_DAYS = retention.outboxDays;
const OUTBOX_RETENTION_BATCH = retention.batchSize;
const config = configStub();

function processor() {
  const outbox = {
    deleteProcessedBefore: vi.fn(async () => 0),
  } as unknown as OutboxService;
  const queue = { upsertJobScheduler: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
  return { outbox, queue, subject: new OutboxRetentionProcessor(outbox, queue, config) };
}

describe('OutboxRetentionProcessor', () => {
  it('cuts at retention.outboxDays, in batches of the retention size, until a batch comes back short', async () => {
    const { subject, outbox } = processor();
    // A full batch, then an empty one: the batch loop (`purgeInBatches`) runs a
    // second statement, and a single delete would stop after the first.
    vi.mocked(outbox.deleteProcessedBefore)
      .mockResolvedValueOnce(OUTBOX_RETENTION_BATCH)
      .mockResolvedValueOnce(0);
    const before = Date.now();
    const rows = await subject.process();

    const calls = vi.mocked(outbox.deleteProcessedBefore).mock.calls;
    expect(calls).toHaveLength(2);
    const [cutoff, batch] = calls[0];
    expect(Math.round((before - cutoff.getTime()) / 86_400_000)).toBe(OUTBOX_RETENTION_DAYS);
    expect(batch).toBe(OUTBOX_RETENTION_BATCH);
    expect(calls[1]).toEqual([cutoff, OUTBOX_RETENTION_BATCH]);
    expect(rows).toBe(OUTBOX_RETENTION_BATCH);
  });

  it('schedules itself once, by id, so every replica upserts the same entry', async () => {
    const { subject, queue } = processor();
    await subject.onApplicationBootstrap();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'outbox-retention-daily',
      { pattern: '53 4 * * *', tz: 'UTC' },
      { name: 'purge' },
    );
  });
});
