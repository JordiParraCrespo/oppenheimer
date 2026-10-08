/**
 * The backlog gauges: every queue is read in every state, the outbox's three
 * numbers are set from its one `backlog()` read, a source that fails keeps its
 * last values and reports the failure, a missing queue fails the boot, nothing
 * samples on a deployment that exports no metrics, and a slow pass delays the
 * next instead of overlapping it. The backlog statement itself is
 * `OutboxService`'s, covered by the outbox integration suite.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OutboxBacklog } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BacklogMetricsSampler, QUEUE_STATES } from '../infrastructure/backlog-metrics.adapter';

const gauge = () => ({ set: vi.fn() });
const INTERVAL_MS = 15_000;

function sampler(options: {
  token?: string;
  queueFails?: boolean;
  oldest?: Date | null;
  backlog?: () => Promise<OutboxBacklog>;
  missingQueue?: string;
}) {
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
  const outbox = {
    backlog: vi.fn(
      options.backlog ??
        (async () => ({ pending: 4, failed: 5, oldestPendingAt: options.oldest ?? null })),
    ),
  };
  const moduleRef = {
    get: vi.fn((token: string) => {
      if (options.missingQueue && String(token).includes(options.missingQueue)) {
        throw new Error(`Nest could not find ${String(token)} element`);
      }
      return queue;
    }),
  };
  const config = new ConfigService({
    health: { metricsToken: options.token, metricsSampleIntervalMs: INTERVAL_MS },
  });
  const instance = new BacklogMetricsSampler(
    gauges.queueJobs,
    gauges.outboxMessages,
    gauges.oldestPending,
    gauges.success,
    gauges.timestamp,
    outbox as never,
    moduleRef as never,
    config,
  );
  return { instance, gauges, queue, outbox, moduleRef };
}

describe('backlog metrics', () => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  afterEach(() => vi.useRealTimers());

  it('resolves every queue but samples nothing without METRICS_TOKEN', () => {
    vi.useFakeTimers();
    const { instance, moduleRef, outbox } = sampler({});

    instance.onApplicationBootstrap();

    expect(moduleRef.get).toHaveBeenCalledTimes(Object.values(QUEUE_NAMES).length);
    expect(outbox.backlog).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails the boot naming a queue that is not registered', () => {
    const { instance } = sampler({ missingQueue: QUEUE_NAMES.AUTOMATION_RUNS });

    expect(() => instance.onApplicationBootstrap()).toThrow(
      `queue "${QUEUE_NAMES.AUTOMATION_RUNS}" is not registered`,
    );
  });

  it('reads every queue in every state and the outbox, then reports success', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00Z') });
    const { instance, gauges, queue, outbox } = sampler({
      oldest: new Date('2026-10-08T11:59:00Z'),
    });
    instance.onApplicationBootstrap();

    await instance.sample();

    expect(queue.getJobCounts).toHaveBeenCalledWith(...QUEUE_STATES);
    const queues = Object.values(QUEUE_NAMES);
    expect(gauges.queueJobs.set).toHaveBeenCalledWith({ queue: queues[0], state: 'waiting' }, 3);
    expect(gauges.queueJobs.set).toHaveBeenCalledWith({ queue: queues[0], state: 'failed' }, 2);
    expect(outbox.backlog).toHaveBeenCalledTimes(1);
    expect(gauges.outboxMessages.set).toHaveBeenCalledWith({ status: 'pending' }, 4);
    expect(gauges.outboxMessages.set).toHaveBeenCalledWith({ status: 'failed' }, 5);
    expect(gauges.oldestPending.set).toHaveBeenCalledWith(60);
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'queues' }, 1);
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'outbox' }, 1);
  });

  it('keeps the last values of a source that fails and says it failed', async () => {
    const { instance, gauges } = sampler({ queueFails: true });
    instance.onApplicationBootstrap();
    for (const g of Object.values(gauges)) g.set.mockClear();

    await instance.sample();

    expect(gauges.queueJobs.set).not.toHaveBeenCalled();
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'queues' }, 0);
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'outbox' }, 1);
    expect(gauges.timestamp.set).not.toHaveBeenCalledWith({ source: 'queues' }, expect.anything());
  });

  it('sets no outbox gauge from a failed read, so the three never disagree', async () => {
    const { instance, gauges } = sampler({
      backlog: async () => {
        throw new Error('connection terminated');
      },
    });

    await instance.sample();

    expect(gauges.outboxMessages.set).not.toHaveBeenCalled();
    expect(gauges.oldestPending.set).not.toHaveBeenCalled();
    expect(gauges.success.set).toHaveBeenCalledWith({ source: 'outbox' }, 0);
  });

  it('reports an empty outbox as zero age, not a missing series', async () => {
    const { instance, gauges } = sampler({ oldest: null });

    await instance.sample();

    expect(gauges.oldestPending.set).toHaveBeenCalledWith(0);
  });

  it('schedules the next pass only once a slow one settles, and stops on destroy', async () => {
    vi.useFakeTimers();
    let release: () => void = () => {};
    let calls = 0;
    const { instance, outbox } = sampler({
      token: 'x'.repeat(32),
      backlog: () => {
        calls += 1;
        // The first read hangs for three intervals; the rest answer at once.
        if (calls > 1) return Promise.resolve({ pending: 0, failed: 0, oldestPendingAt: null });
        return new Promise((resolve) => {
          release = () => resolve({ pending: 0, failed: 0, oldestPendingAt: null });
        });
      },
    });

    instance.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    // Still the one pass: none stacked up behind it.
    expect(outbox.backlog).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.backlog).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(outbox.backlog).toHaveBeenCalledTimes(2);

    instance.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    expect(outbox.backlog).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
