import {
  type OutboxMessageRecord,
  OutboxRelay,
  type OutboxService,
} from '@oppenheimer/backend-ddd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The relay's contract: claim → publish → mark processed, with failures marked
 * (not dropped) and drains serialized. The claim/mark SQL itself is exercised
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
    registerDrainer: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    outbox = {
      claim: vi.fn().mockResolvedValue([]),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
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
    expect(outbox.markProcessed).toHaveBeenCalledWith(['a']);
    expect(outbox.markProcessed).toHaveBeenCalledWith(['b']);
    expect(outbox.markFailed).not.toHaveBeenCalled();
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
    expect(outbox.markProcessed).toHaveBeenCalledWith(['good']);
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

  it('serializes concurrent drains instead of interleaving them', async () => {
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

  it('registers itself as the wake drainer on start and unregisters on stop', async () => {
    const relay = relayWith(async () => {});
    relay.start();
    expect(outbox.registerDrainer).toHaveBeenCalledWith(expect.any(Function));
    await relay.stop();
    expect(outbox.registerDrainer).toHaveBeenLastCalledWith(undefined);
  });
});
