import { describe, expect, it } from 'vitest';
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
    const at = (data?: { isProvisioning: boolean }) =>
      typeof poll.refetchInterval === 'function' ? poll.refetchInterval({ state: { data } }) : null;

    expect(at({ isProvisioning: true })).toBe(LIVE_POLL.sessionStarting.interval);
    expect(at({ isProvisioning: false })).toBe(false);
    expect(at(undefined)).toBe(false);
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
