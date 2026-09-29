import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { configDefaults, configStub } from '../../config/__tests__/config-stub';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { HostRetentionProcessor } from '../infrastructure/host-retention.processor';

const { retention } = configDefaults();
const RETENTION_BATCH = retention.batchSize;
const config = configStub();

function processor(networks: number[], timeline: number[]) {
  const metadata = {
    deleteNetworksUnseenSince: vi.fn(async () => networks.shift() ?? 0),
    deleteTimelineBefore: vi.fn(async () => timeline.shift() ?? 0),
  } as unknown as HostMetadataRepositoryPort;
  const queue = { upsertJobScheduler: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
  return { metadata, queue, subject: new HostRetentionProcessor(metadata, queue, config) };
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

  it('cuts networks and the timeline at their retention (90 and 180 days by default)', async () => {
    const { subject, metadata } = processor([], []);
    const before = Date.now();
    await subject.process();

    const [networkCutoff] = vi.mocked(metadata.deleteNetworksUnseenSince).mock.calls[0];
    const [timelineCutoff] = vi.mocked(metadata.deleteTimelineBefore).mock.calls[0];
    const days = (cutoff: Date) => Math.round((before - cutoff.getTime()) / 86_400_000);
    expect(days(networkCutoff)).toBe(retention.hostNetworkDays);
    expect(days(timelineCutoff)).toBe(retention.hostTimelineDays);
    // The product's numbers (15-host-metadata.md), as a deployment that sets nothing gets them.
    expect([retention.hostNetworkDays, retention.hostTimelineDays]).toEqual([90, 180]);
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
