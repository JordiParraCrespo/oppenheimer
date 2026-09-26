import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import {
  HostRetentionProcessor,
  RETENTION_BATCH,
} from '../infrastructure/host-retention.processor';

function processor(networks: number[], timeline: number[]) {
  const metadata = {
    deleteNetworksUnseenSince: vi.fn(async () => networks.shift() ?? 0),
    deleteTimelineBefore: vi.fn(async () => timeline.shift() ?? 0),
  } as unknown as HostMetadataRepositoryPort;
  const queue = { upsertJobScheduler: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
  return { metadata, queue, subject: new HostRetentionProcessor(metadata, queue) };
}

describe('HostRetentionProcessor', () => {
  it('drains in batches until a batch comes back short', async () => {
    const { subject, metadata } = processor([RETENTION_BATCH, RETENTION_BATCH, 12], [3]);

    await expect(subject.process()).resolves.toEqual({
      networks: 2 * RETENTION_BATCH + 12,
      timeline: 3,
    });
    expect(metadata.deleteNetworksUnseenSince).toHaveBeenCalledTimes(3);
    expect(metadata.deleteTimelineBefore).toHaveBeenCalledTimes(1);
  });

  it('cuts networks at 90 days and the timeline at 180', async () => {
    const { subject, metadata } = processor([], []);
    const before = Date.now();
    await subject.process();

    const [networkCutoff] = vi.mocked(metadata.deleteNetworksUnseenSince).mock.calls[0];
    const [timelineCutoff] = vi.mocked(metadata.deleteTimelineBefore).mock.calls[0];
    const days = (cutoff: Date) => Math.round((before - cutoff.getTime()) / 86_400_000);
    expect(days(networkCutoff)).toBe(90);
    expect(days(timelineCutoff)).toBe(180);
  });

  it('schedules itself once, by id, so every replica upserts the same entry', async () => {
    const { subject, queue } = processor([], []);
    await subject.onApplicationBootstrap();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'host-retention-daily',
      expect.objectContaining({ pattern: '17 3 * * *' }),
      { name: 'purge' },
    );
  });
});
