import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { configDefaults, configStub } from '../../config/__tests__/config-stub';
import { OutboxRetentionProcessor } from '../infrastructure/outbox-retention.processor';

const { retention } = configDefaults();
const OUTBOX_RETENTION_DAYS = retention.outboxDays;
const OUTBOX_RETENTION_BATCH = retention.batchSize;
const MAX_BATCHES = retention.maxBatches;
const config = configStub();

function processor(batches: number[] | (() => number)) {
  const next = typeof batches === 'function' ? batches : () => batches.shift() ?? 0;
  const outbox = {
    deleteProcessedBefore: vi.fn(async () => next()),
  } as unknown as OutboxService;
  const queue = { upsertJobScheduler: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
  return { outbox, queue, subject: new OutboxRetentionProcessor(outbox, queue, config) };
}

describe('OutboxRetentionProcessor', () => {
  it('purges in batches until a batch comes back short', async () => {
    const { subject, outbox } = processor([OUTBOX_RETENTION_BATCH, OUTBOX_RETENTION_BATCH, 7]);

    await expect(subject.process()).resolves.toBe(2 * OUTBOX_RETENTION_BATCH + 7);
    expect(outbox.deleteProcessedBefore).toHaveBeenCalledTimes(3);
  });

  it('stops after maxBatches batches, leaving the rest for the next run', async () => {
    const { subject, outbox } = processor(() => OUTBOX_RETENTION_BATCH);

    await expect(subject.process()).resolves.toBe(MAX_BATCHES * OUTBOX_RETENTION_BATCH);
    expect(outbox.deleteProcessedBefore).toHaveBeenCalledTimes(MAX_BATCHES);
  });

  it('cuts at seven days, in batches of the retention size', async () => {
    const { subject, outbox } = processor([]);
    const before = Date.now();
    await subject.process();

    const [cutoff, batch] = vi.mocked(outbox.deleteProcessedBefore).mock.calls[0];
    expect(Math.round((before - cutoff.getTime()) / 86_400_000)).toBe(OUTBOX_RETENTION_DAYS);
    expect(OUTBOX_RETENTION_DAYS).toBe(7);
    expect(batch).toBe(OUTBOX_RETENTION_BATCH);
  });

  it('schedules itself once, by id, so every replica upserts the same entry', async () => {
    const { subject, queue } = processor([]);
    await subject.onApplicationBootstrap();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'outbox-retention-daily',
      { pattern: '53 4 * * *', tz: 'UTC' },
      { name: 'purge' },
    );
  });
});
