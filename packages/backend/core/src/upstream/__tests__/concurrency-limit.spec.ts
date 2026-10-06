import { describe, expect, it } from 'vitest';
import { ConcurrencyLimit, ConcurrencyLimitSaturatedError } from '../concurrency-limit';

const ROOMY = { maxQueued: 100, maxWaitMs: 5_000 };

describe('ConcurrencyLimit', () => {
  it('never has more than its limit in flight, however many are queued', async () => {
    const limit = new ConcurrencyLimit(3, ROOMY);
    let inFlight = 0;
    let peak = 0;

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        limit.run(async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, index % 3));
          inFlight -= 1;
          return index;
        }),
      ),
    );

    expect(peak).toBe(3);
    expect(results).toEqual(Array.from({ length: 20 }, (_, index) => index));
  });

  it('frees the slot of a call that failed', async () => {
    const limit = new ConcurrencyLimit(1, ROOMY);
    await expect(limit.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    expect(await limit.run(async () => 'next')).toBe('next');
  });

  it('refuses at once past the queue it may hold, instead of making a request wait', async () => {
    const limit = new ConcurrencyLimit(1, { maxQueued: 1, maxWaitMs: 5_000 });
    let release!: () => void;
    const busy = limit.run(() => new Promise<void>((resolve) => (release = resolve)));
    const queued = limit.run(async () => 'queued');

    await expect(limit.run(async () => 'third')).rejects.toBeInstanceOf(
      ConcurrencyLimitSaturatedError,
    );
    release();
    await busy;
    expect(await queued).toBe('queued');
  });

  it('gives up on a slot that does not come in time, and never runs that call', async () => {
    const limit = new ConcurrencyLimit(1, { maxQueued: 10, maxWaitMs: 20 });
    let release!: () => void;
    const busy = limit.run(() => new Promise<void>((resolve) => (release = resolve)));
    let ran = false;

    await expect(
      limit.run(async () => {
        ran = true;
      }),
    ).rejects.toBeInstanceOf(ConcurrencyLimitSaturatedError);
    release();
    await busy;
    expect(ran).toBe(false);
    expect(await limit.run(async () => 'free')).toBe('free');
  });
});
