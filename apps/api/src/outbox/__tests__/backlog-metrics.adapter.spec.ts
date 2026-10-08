/**
 * The backlog gauges: every queue is read in every state, the outbox's pending
 * count, failed count and oldest pending age are set, a source that fails
 * keeps its last values and reports the failure, and nothing samples on a
 * deployment that exports no metrics. The pending-row query is faked here;
 * no suite runs it against Postgres yet.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BacklogMetricsSampler, QUEUE_STATES } from '../infrastructure/backlog-metrics.adapter';

const gauge = () => ({ set: vi.fn() });

function sampler(options: { token?: string; queueFails?: boolean; oldest?: Date | null }) {
  const gauges = {
    queueJobs: gauge(),
    outboxMessages: gauge(),
    oldestPending: gauge(),
    success: gauge(),
    timestamp: gauge(),
  };
  const queue = {
    getJobCounts: vi.fn(async () => {
      if (options.queueFails) throw new Error('Connection is closed');
      return { waiting: 3, active: 1, delayed: 0, prioritized: 0, failed: 2 };
    }),
  };
  const dataSource = {
    isInitialized: true,
    query: vi.fn(async () => [{ count: 4, oldest: options.oldest ?? null }]),
  };
  const outbox = { countFailed: vi.fn(async () => 5) };
  const moduleRef = { get: vi.fn(() => queue) };
  const config = new ConfigService({
    health: { metricsToken: options.token, metricsSampleIntervalMs: 15_000 },
  });
  const instance = new BacklogMetricsSampler(
    gauges.queueJobs,
    gauges.outboxMessages,
    gauges.oldestPending,
    gauges.success,
    gauges.timestamp,
    outbox as never,
    dataSource as never,
    moduleRef as never,
    config,
  );
  return { instance, gauges, queue, dataSource, moduleRef };
}

describe('backlog metrics', () => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  afterEach(() => vi.useRealTimers());

  it('does not sample at all without METRICS_TOKEN', () => {
    vi.useFakeTimers();
    const { instance, moduleRef, dataSource } = sampler({});

    instance.onApplicationBootstrap();

    expect(moduleRef.get).not.toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reads every queue in every state and the outbox, then reports success', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00Z') });
    const { instance, gauges, queue } = sampler({
      token: 'x'.repeat(32),
      oldest: new Date('2026-10-08T11:59:00Z'),
    });

    instance.onApplicationBootstrap();
    await instance.sample();
    instance.onModuleDestroy();

    expect(queue.getJobCounts).toHaveBeenCalledWith(...QUEUE_STATES);
    const queues = Object.values(QUEUE_NAMES);
    expect(gauges.queueJobs.set).toHaveBeenCalledWith({ queue: queues[0], state: 'waiting' }, 3);
    expect(gauges.queueJobs.set).toHaveBeenCalledWith({ queue: queues[0], state: 'failed' }, 2);
    expect(gauges.outboxMessages.set).toHaveBeenCalledWith({ status: 'pending' }, 4);
    expect(gauges.outboxMessages.set).toHaveBeenCalledWith({ status: 'failed' }, 5);
    expect(gauges.oldestPending.set).toHaveBeenCalledWith(60);
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'queues' }, 1);
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'outbox' }, 1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the last values of a source that fails and says it failed', async () => {
    const { instance, gauges } = sampler({ token: 'x'.repeat(32), queueFails: true });
    instance.onApplicationBootstrap();
    instance.onModuleDestroy();
    // the bootstrap's own first pass and its zeroes are not what is under test
    await instance.sample();
    for (const g of Object.values(gauges)) g.set.mockClear();

    await instance.sample();

    expect(gauges.queueJobs.set).not.toHaveBeenCalled();
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'queues' }, 0);
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'outbox' }, 1);
    expect(gauges.timestamp.set).not.toHaveBeenCalledWith({ source: 'queues' }, expect.anything());
  });

  it('reports an empty outbox as zero age, not a missing series', async () => {
    const { instance, gauges } = sampler({ token: 'x'.repeat(32), oldest: null });

    await instance.sample();

    expect(gauges.oldestPending.set).toHaveBeenCalledWith(0);
  });
});
