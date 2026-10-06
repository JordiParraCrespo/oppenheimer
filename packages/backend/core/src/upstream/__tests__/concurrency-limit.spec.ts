import { describe, expect, it } from 'vitest';
import { ConcurrencyLimit } from '../concurrency-limit';

describe('ConcurrencyLimit', () => {
  it('never has more than its limit in flight, however many are queued', async () => {
    const limit = new ConcurrencyLimit(3);
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
    const limit = new ConcurrencyLimit(1);
    await expect(limit.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    expect(await limit.run(async () => 'next')).toBe('next');
  });
});
