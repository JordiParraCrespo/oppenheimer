/**
 * The deadline a readiness check waits under: it answers with the operation's
 * own result or rejection inside the bound, a `DependencyTimeoutError` past
 * it, clears its timer either way, and observes the operation it gave up on,
 * so a dependency that fails after the deadline never becomes an
 * `unhandledRejection` (which ends the process).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DependencyTimeoutError, withDeadline } from '../infrastructure/dependency-deadline.util';

describe('withDeadline', () => {
  afterEach(() => vi.useRealTimers());

  it("answers the operation's result inside the deadline and holds no timer", async () => {
    vi.useFakeTimers();

    await expect(withDeadline('PostgreSQL', 1_000, async () => 'ok')).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes the operation's own rejection through when it comes first", async () => {
    await expect(
      withDeadline('Redis', 1_000, async () => {
        throw new Error('ECONNREFUSED');
      }),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('times out, and a rejection after the deadline is not an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      let fail: (error: Error) => void = () => {};
      const late = new Promise<never>((_resolve, reject) => {
        fail = reject;
      });

      await expect(withDeadline('PostgreSQL', 5, () => late)).rejects.toBeInstanceOf(
        DependencyTimeoutError,
      );
      fail(new Error('Connection terminated after the probe gave up'));
      // Give Node a full turn to report an unhandled rejection, if there is one.
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
