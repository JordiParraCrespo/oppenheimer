import { type OutboxMessageRecord, OutboxRelay, OutboxService } from '@oppenheimer/backend-ddd';
import type { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The relay's contract: claim → publish → mark the batch processed, with
 * failures marked (not dropped), one drain at a time, and wakes that never wait
 * for delivery. The claim/mark SQL itself is exercised
 * by the integration suite against a real Postgres.
 */
describe('OutboxRelay', () => {
  const message = (overrides: Partial<OutboxMessageRecord> = {}): OutboxMessageRecord => ({
    id: 'msg-1',
    channel: 'event',
    topic: null,
    eventName: 'SomethingHappenedDomainEvent',
    aggregateId: 'agg-1',
    payload: { aggregateId: 'agg-1' },
    reason: 'test row',
    status: 'pending',
    attempts: 1,
    availableAt: new Date(),
    lockedBy: null,
    lockedUntil: null,
    lastError: null,
    correlationId: null,
    createdAt: new Date(),
    processedAt: null,
    ...overrides,
  });

  let outbox: {
    claim: ReturnType<typeof vi.fn>;
    markProcessed: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    extendLease: ReturnType<typeof vi.fn>;
    registerDrainer: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    outbox = {
      claim: vi.fn().mockResolvedValue([]),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      extendLease: vi.fn(async (_owner: string, ids: string[]) => ids),
      registerDrainer: vi.fn(),
    };
  });

  const relayWith = (publisher: (m: OutboxMessageRecord) => Promise<void>) =>
    new OutboxRelay(outbox as unknown as OutboxService, publisher, {
      owner: 'test:1',
    });

  it('publishes each claimed row and marks it processed', async () => {
    const rows = [message({ id: 'a' }), message({ id: 'b' })];
    outbox.claim.mockResolvedValueOnce(rows).mockResolvedValue([]);
    const published: string[] = [];
    const relay = relayWith(async (m) => {
      published.push(m.id);
    });

    const delivered = await relay.drainOnce();

    expect(delivered).toBe(2);
    expect(published).toEqual(['a', 'b']);
    expect(outbox.markProcessed).toHaveBeenCalledWith(['a', 'b'], 'test:1');
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('marks a batch processed in one call', async () => {
    const rows = [message({ id: 'a' }), message({ id: 'b' }), message({ id: 'c' })];
    outbox.claim.mockResolvedValueOnce(rows).mockResolvedValue([]);
    const relay = relayWith(async () => {});

    await relay.drainOnce();

    expect(outbox.markProcessed).toHaveBeenCalledTimes(1);
    expect(outbox.markProcessed).toHaveBeenCalledWith(['a', 'b', 'c'], 'test:1');
  });

  it('marks a failed row failed alone and the rest of the batch processed in one call', async () => {
    const rows = [message({ id: 'a' }), message({ id: 'bad' }), message({ id: 'c' })];
    outbox.claim.mockResolvedValueOnce(rows).mockResolvedValue([]);
    const relay = relayWith(async (m) => {
      if (m.id === 'bad') throw new Error('listener threw');
    });

    await expect(relay.drainOnce()).resolves.toBe(2);

    expect(outbox.markFailed).toHaveBeenCalledTimes(1);
    expect(outbox.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bad' }),
      'listener threw',
    );
    expect(outbox.markProcessed).toHaveBeenCalledTimes(1);
    expect(outbox.markProcessed).toHaveBeenCalledWith(['a', 'c'], 'test:1');
  });

  it('stops the drain when the batch cannot be marked, leaving the leases to lapse', async () => {
    const full = Array.from({ length: 20 }, (_, i) => message({ id: `full-${i}` }));
    outbox.claim.mockResolvedValueOnce(full).mockResolvedValue([]);
    outbox.markProcessed.mockRejectedValueOnce(new Error('connection reset'));
    const relay = relayWith(async () => {});

    await expect(relay.drainOnce()).resolves.toBe(0);
    expect(outbox.claim).toHaveBeenCalledTimes(1);
  });

  it('marks a row failed when the publisher rejects, and keeps going', async () => {
    const rows = [message({ id: 'bad' }), message({ id: 'good' })];
    outbox.claim.mockResolvedValueOnce(rows).mockResolvedValue([]);
    const relay = relayWith(async (m) => {
      if (m.id === 'bad') throw new Error('redis is down');
    });

    const delivered = await relay.drainOnce();

    expect(delivered).toBe(1);
    expect(outbox.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bad' }),
      'redis is down',
    );
    expect(outbox.markProcessed).toHaveBeenCalledWith(['good'], 'test:1');
  });

  it('keeps claiming until a batch comes back short', async () => {
    const full = Array.from({ length: 20 }, (_, i) => message({ id: `full-${i}` }));
    const short = [message({ id: 'last' })];
    outbox.claim.mockResolvedValueOnce(full).mockResolvedValueOnce(short);
    const relay = relayWith(async () => {});

    const delivered = await relay.drainOnce();

    expect(delivered).toBe(21);
    expect(outbox.claim).toHaveBeenCalledTimes(2);
  });

  it('survives a claim failure (database briefly unreachable)', async () => {
    outbox.claim.mockRejectedValueOnce(new Error('connection refused'));
    const relay = relayWith(async () => {});

    await expect(relay.drainOnce()).resolves.toBe(0);
  });

  it('runs one drain at a time instead of interleaving them', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    outbox.claim
      .mockImplementationOnce(async () => {
        order.push('claim-1');
        await gate;
        return [];
      })
      .mockImplementationOnce(async () => {
        order.push('claim-2');
        return [];
      });
    const relay = relayWith(async () => {});

    const first = relay.drainOnce();
    const second = relay.drainOnce();
    // Let the first drain reach its claim; the second must not claim until
    // the first finished.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(['claim-1']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['claim-1', 'claim-2']);
  });

  it('does not deadlock when a delivery wakes the relay, and delivers what it staged', async () => {
    // An event handler that dispatches a command whose repository stages the
    // next job and wakes the relay: that wake runs inside the drain it waits on.
    outbox.claim
      .mockResolvedValueOnce([message({ id: 'event' })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([message({ id: 'job', channel: 'queue' })])
      .mockResolvedValue([]);
    const published: string[] = [];
    let nested: Promise<number> | undefined;
    const relay = relayWith(async (m) => {
      published.push(m.id);
      if (m.id === 'event') {
        nested = relay.drainOnce();
        await nested;
      }
    });

    await relay.drainOnce();
    await expect(nested).resolves.toBe(0);
    // The queued pass picks up the staged job; a later wake waits for it.
    await relay.drainOnce();
    expect(published).toEqual(['event', 'job']);
  });

  it('collapses the requests made during a drain into one more pass', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const passes: string[] = [];
    outbox.claim
      .mockImplementationOnce(async () => {
        passes.push('pass-1');
        await gate;
        return [];
      })
      .mockImplementation(async () => {
        passes.push('pass-2');
        return [];
      });
    const relay = relayWith(async () => {});

    const first = relay.requestDrain();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const during = Array.from({ length: 5 }, () => relay.requestDrain());
    release();
    await Promise.all([first, ...during]);

    expect(passes).toEqual(['pass-1', 'pass-2']);
    // Idle again: the next request starts a new drain.
    await relay.requestDrain();
    expect(outbox.claim).toHaveBeenCalledTimes(3);
  });

  it('a wake does not wait for a slow publisher', async () => {
    let release: () => void = () => {};
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = new OutboxService({} as DataSource);
    vi.spyOn(service, 'claim')
      .mockResolvedValueOnce([message({ id: 'slow' })])
      .mockResolvedValue([]);
    const markProcessed = vi.spyOn(service, 'markProcessed').mockResolvedValue(undefined);
    const relay = new OutboxRelay(service, () => slow, { owner: 'test:1' });
    relay.start();

    // The first wake starts a drain that blocks on the publisher; the second
    // lands while it runs. Neither waits for it.
    expect(service.wake()).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(service.wake()).toBeUndefined();
    expect(markProcessed).not.toHaveBeenCalled();

    release();
    await relay.stop();
    expect(markProcessed).toHaveBeenCalledWith(['slow'], 'test:1');
  });

  it('stop() waits for the running drain', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    outbox.claim.mockResolvedValueOnce([message({ id: 'a' })]).mockResolvedValue([]);
    const relay = relayWith(() => gate);
    void relay.requestDrain();
    await new Promise((resolve) => setTimeout(resolve, 0));

    let stopped = false;
    const stopping = relay.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stopped).toBe(false);

    release();
    await stopping;
    expect(outbox.markProcessed).toHaveBeenCalledWith(['a'], 'test:1');
  });

  it('registers itself as the wake drainer on start and unregisters on stop', async () => {
    const relay = relayWith(async () => {});
    relay.start();
    expect(outbox.registerDrainer).toHaveBeenCalledWith(expect.any(Function));
    await relay.stop();
    expect(outbox.registerDrainer).toHaveBeenLastCalledWith(undefined);
  });

  describe('the lease heartbeat', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    /** A publisher that blocks until `release()`, and the relay around it. */
    const slowRelay = (options: { leaseMs?: number; heartbeatMs?: number } = {}) => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const logger = { warn: vi.fn() };
      const relay = new OutboxRelay(
        outbox as unknown as OutboxService,
        (m) => (m.id === 'bad' ? Promise.reject(new Error('listener threw')) : gate),
        { owner: 'test:1', logger, ...options },
      );
      return { relay, release: () => release(), logger };
    };

    it('renews the batch lease while a slow publisher runs, and stops after', async () => {
      vi.useFakeTimers();
      outbox.claim.mockResolvedValueOnce([message({ id: 'a' })]).mockResolvedValue([]);
      const { relay, release } = slowRelay({ leaseMs: 3_000 });
      const drain = relay.requestDrain();

      // Every leaseMs / 3 by default.
      await vi.advanceTimersByTimeAsync(3_500);
      expect(outbox.extendLease).toHaveBeenCalledTimes(3);
      expect(outbox.extendLease).toHaveBeenLastCalledWith('test:1', ['a'], 3_000);

      release();
      await drain;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(outbox.extendLease).toHaveBeenCalledTimes(3);
      expect(outbox.markProcessed).toHaveBeenCalledWith(['a'], 'test:1');
    });

    it('stops renewing a row once it is marked failed', async () => {
      vi.useFakeTimers();
      outbox.claim
        .mockResolvedValueOnce([message({ id: 'bad' }), message({ id: 'slow' })])
        .mockResolvedValue([]);
      const { relay, release } = slowRelay({ leaseMs: 900, heartbeatMs: 300 });
      const drain = relay.requestDrain();

      await vi.advanceTimersByTimeAsync(300);
      expect(outbox.extendLease).toHaveBeenLastCalledWith('test:1', ['slow'], 900);

      release();
      await drain;
    });

    it('logs a row whose lease was lost and stops renewing it', async () => {
      vi.useFakeTimers();
      outbox.claim
        .mockResolvedValueOnce([message({ id: 'a' }), message({ id: 'b' })])
        .mockResolvedValue([]);
      outbox.extendLease.mockResolvedValueOnce(['a']);
      const { relay, release, logger } = slowRelay({ leaseMs: 900, heartbeatMs: 300 });
      const drain = relay.requestDrain();

      await vi.advanceTimersByTimeAsync(600);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('lease lost on 1 row(s)'));
      expect(outbox.extendLease).toHaveBeenLastCalledWith('test:1', ['a'], 900);

      release();
      await drain;
    });

    it('keeps delivering when a renewal fails', async () => {
      vi.useFakeTimers();
      outbox.claim.mockResolvedValueOnce([message({ id: 'a' })]).mockResolvedValue([]);
      outbox.extendLease.mockRejectedValueOnce(new Error('connection reset'));
      const { relay, release, logger } = slowRelay({ leaseMs: 900, heartbeatMs: 300 });
      const drain = relay.requestDrain();

      await vi.advanceTimersByTimeAsync(600);
      expect(logger.warn).toHaveBeenCalledWith('Outbox lease renewal failed: connection reset');
      expect(outbox.extendLease).toHaveBeenCalledTimes(2);

      release();
      await expect(drain).resolves.toBe(1);
    });
  });
});
