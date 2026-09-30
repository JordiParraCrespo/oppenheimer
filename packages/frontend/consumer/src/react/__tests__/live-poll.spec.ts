import { describe, expect, it, vi } from 'vitest';
import { LIVE_POLL, pollWhile } from '../live-poll';

/**
 * The catalog decides both halves of a poll: a hook says only when the thing
 * it watches is still moving.
 */
describe('pollWhile', () => {
  it('asks at the catalog pace while the predicate holds, and stops when it does not', () => {
    const poll = pollWhile<{ isProvisioning: boolean }>(
      'sessionStarting',
      (session) => session?.isProvisioning ?? false,
    );
    const at = (data?: { isProvisioning: boolean }, queryHash = 'q') =>
      typeof poll.refetchInterval === 'function'
        ? poll.refetchInterval({ queryHash, state: { data } })
        : null;

    expect(at({ isProvisioning: true })).toBe(LIVE_POLL.sessionStarting.openingInterval);
    expect(at({ isProvisioning: false })).toBe(false);
    expect(at(undefined)).toBe(false);
  });

  /**
   * The regression: the host builds the terminal before it clones, so the
   * answer this poll waits for is usually there inside a second. Asking every
   * two seconds spent most of that second waiting for a tick, and the console
   * drew a provisioning stepper over a pane that was already live.
   */
  it('opens faster than it settles, and settles once the opening is over', () => {
    vi.useFakeTimers();
    try {
      const poll = pollWhile<{ isProvisioning: boolean }>(
        'sessionStarting',
        (session) => session?.isProvisioning ?? false,
      );
      const at = () =>
        typeof poll.refetchInterval === 'function'
          ? poll.refetchInterval({
              queryHash: 'opening',
              state: { data: { isProvisioning: true } },
            })
          : null;

      expect(at()).toBe(LIVE_POLL.sessionStarting.openingInterval);
      vi.advanceTimersByTime(LIVE_POLL.sessionStarting.openingForMs + 1);
      expect(at()).toBe(LIVE_POLL.sessionStarting.interval);
    } finally {
      vi.useRealTimers();
    }
  });

  /** A second start does not inherit the first one's clock. */
  it('opens fast again once the thing it was watching has settled', () => {
    vi.useFakeTimers();
    try {
      const poll = pollWhile<{ isProvisioning: boolean }>(
        'sessionStarting',
        (session) => session?.isProvisioning ?? false,
      );
      const call = (isProvisioning: boolean) =>
        typeof poll.refetchInterval === 'function'
          ? poll.refetchInterval({ queryHash: 'restarted', state: { data: { isProvisioning } } })
          : null;

      expect(call(true)).toBe(LIVE_POLL.sessionStarting.openingInterval);
      vi.advanceTimersByTime(LIVE_POLL.sessionStarting.openingForMs + 1);
      expect(call(true)).toBe(LIVE_POLL.sessionStarting.interval);
      expect(call(false)).toBe(false);
      expect(call(true)).toBe(LIVE_POLL.sessionStarting.openingInterval);
    } finally {
      vi.useRealTimers();
    }
  });

  it('carries whether the poll survives a hidden tab from the catalog, never from the hook', () => {
    expect(pollWhile('sessionStarting', true).refetchIntervalInBackground).toBe(true);
    expect(pollWhile('hostPresence', true)).toEqual({
      refetchInterval: LIVE_POLL.hostPresence.interval,
      refetchIntervalInBackground: false,
    });
    expect(pollWhile('liveRun', false).refetchInterval).toBe(false);
  });
});
