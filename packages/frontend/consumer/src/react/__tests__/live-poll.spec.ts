import { describe, expect, it, vi } from 'vitest';
import { LIVE_POLL, pollWhile, setStreamedPolls } from '../live-poll';

/**
 * The catalog decides both halves of a poll: a hook says only when the thing
 * it watches is still moving.
 */
describe('pollWhile', () => {
  it('asks at the catalog pace while the predicate holds, and stops when it does not', () => {
    const poll = pollWhile<{ isProvisioning: boolean }>(
      'sessionOpening',
      (session) => session?.isProvisioning ?? false,
    );
    const at = (data?: { isProvisioning: boolean }, queryHash = 'q') =>
      typeof poll.refetchInterval === 'function'
        ? poll.refetchInterval({ queryHash, state: { data } })
        : null;

    expect(at({ isProvisioning: true })).toBe(LIVE_POLL.sessionOpening.openingInterval);
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
        'sessionOpening',
        (session) => session?.isProvisioning ?? false,
      );
      const at = () =>
        typeof poll.refetchInterval === 'function'
          ? poll.refetchInterval({
              queryHash: 'opening',
              state: { data: { isProvisioning: true } },
            })
          : null;

      expect(at()).toBe(LIVE_POLL.sessionOpening.openingInterval);
      vi.advanceTimersByTime(LIVE_POLL.sessionOpening.openingForMs + 1);
      expect(at()).toBe(LIVE_POLL.sessionOpening.interval);
    } finally {
      vi.useRealTimers();
    }
  });

  /** A second start does not inherit the first one's clock. */
  it('opens fast again once the thing it was watching has settled', () => {
    vi.useFakeTimers();
    try {
      const poll = pollWhile<{ isProvisioning: boolean }>(
        'sessionOpening',
        (session) => session?.isProvisioning ?? false,
      );
      const call = (isProvisioning: boolean) =>
        typeof poll.refetchInterval === 'function'
          ? poll.refetchInterval({ queryHash: 'restarted', state: { data: { isProvisioning } } })
          : null;

      expect(call(true)).toBe(LIVE_POLL.sessionOpening.openingInterval);
      vi.advanceTimersByTime(LIVE_POLL.sessionOpening.openingForMs + 1);
      expect(call(true)).toBe(LIVE_POLL.sessionOpening.interval);
      expect(call(false)).toBe(false);
      expect(call(true)).toBe(LIVE_POLL.sessionOpening.openingInterval);
    } finally {
      vi.useRealTimers();
    }
  });

  it('carries whether the poll survives a hidden tab from the catalog, never from the hook', () => {
    expect(pollWhile('sessionStarting', true).refetchIntervalInBackground).toBe(true);
    const presence = pollWhile('hostPresence', true);
    expect(presence.refetchIntervalInBackground).toBe(false);
    expect(presence.refetchInterval({ queryHash: 'hosts', state: {} })).toBe(
      LIVE_POLL.hostPresence.interval,
    );
    expect(pollWhile('liveRun', false).refetchInterval({ queryHash: 'runs', state: {} })).toBe(
      false,
    );
  });
});

/**
 * The workspace stream refetches what a poll would have, the moment it
 * changes. A poll left running beside it is the request every two seconds
 * the stream exists to remove; a poll that stayed down after the stream
 * dropped is a screen that never moves again.
 */
describe('while the workspace stream is live', () => {
  it('stands a poll down, and brings it back when the stream drops', () => {
    const poll = pollWhile<{ isRunning: boolean }>('liveRun', (row) => row?.isRunning ?? false);
    const tick = () =>
      poll.refetchInterval({ queryHash: 'run', state: { data: { isRunning: true } } });
    try {
      setStreamedPolls(['liveRun']);
      expect(tick()).toBe(false);
      setStreamedPolls([]);
      expect(tick()).toBe(LIVE_POLL.liveRun.interval);
    } finally {
      setStreamedPolls([]);
    }
  });

  it('leaves a kind the stream does not cover polling', () => {
    try {
      setStreamedPolls(['liveRun']);
      expect(
        pollWhile('hostPresence', true).refetchInterval({ queryHash: 'hosts', state: {} }),
      ).toBe(LIVE_POLL.hostPresence.interval);
    } finally {
      setStreamedPolls([]);
    }
  });

  /** A poll back from the stream is a fresh wait, so it opens fast again. */
  it('forgets the opening clock while the stream covers it', () => {
    vi.useFakeTimers();
    try {
      const poll = pollWhile<{ isProvisioning: boolean }>(
        'sessionOpening',
        (session) => session?.isProvisioning ?? false,
      );
      const tick = () =>
        poll.refetchInterval({
          queryHash: 'opening-streamed',
          state: { data: { isProvisioning: true } },
        });
      expect(tick()).toBe(LIVE_POLL.sessionOpening.openingInterval);
      vi.advanceTimersByTime(LIVE_POLL.sessionOpening.openingForMs + 1);
      setStreamedPolls(['sessionOpening']);
      expect(tick()).toBe(false);
      setStreamedPolls([]);
      expect(tick()).toBe(LIVE_POLL.sessionOpening.openingInterval);
    } finally {
      setStreamedPolls([]);
      vi.useRealTimers();
    }
  });
});

/**
 * The regression the split catalog exists for: the opening clock is kept per
 * query, and the session **list** is one query for every session. Given an
 * opening phase, a second session started while the first was still cloning
 * would inherit the first one's settled tick. The list has no opening phase,
 * so there is no clock to inherit.
 */
describe('the session list', () => {
  it("has one pace, so no session inherits another session's clock", () => {
    vi.useFakeTimers();
    try {
      const poll = pollWhile<{ isProvisioning: boolean }[]>('sessionStarting', (rows) =>
        (rows ?? []).some((row) => row.isProvisioning),
      );
      const at = () =>
        typeof poll.refetchInterval === 'function'
          ? poll.refetchInterval({
              queryHash: 'the-one-list',
              state: { data: [{ isProvisioning: true }] },
            })
          : null;

      // The same pace at the first tick and long after: no opening phase to inherit.
      expect(at()).toBe(LIVE_POLL.sessionStarting.interval);
      vi.advanceTimersByTime(10_000);
      expect(at()).toBe(LIVE_POLL.sessionStarting.interval);
      expect('openingInterval' in LIVE_POLL.sessionStarting).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
