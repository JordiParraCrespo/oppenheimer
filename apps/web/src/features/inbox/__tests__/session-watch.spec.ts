// @vitest-environment node
import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { describe, expect, it } from 'vitest';
import { STALE_AFTER_MS, watchSessions } from '../lib/session-alerts';

/**
 * Two reminders a reader gets besides a wait: a turn that ended (the row's dot
 * went blue) and a session that has needed them for thirty minutes. Each is
 * told once, and what was already blue or long waiting when the console
 * opened is never announced; a break would ring on every load, or never.
 */
const T0 = Date.parse('2026-11-24T10:00:00Z');
const MINUTE = 60_000;

describe('a turn that ends', () => {
  it('is told when a working session goes blue, once', () => {
    const first = watchSessions(null, [sessionEntity({ id: 'a', state: 'working' })], T0);
    const blue = [sessionEntity({ id: 'a', state: 'ready-for-review' })];
    const second = watchSessions(first.watches, blue, T0 + MINUTE);
    expect(second.done.map((s) => s.id)).toEqual(['a']);
    expect(watchSessions(second.watches, blue, T0 + 2 * MINUTE).done).toEqual([]);
  });

  it('is not told for a session already blue when the console opened', () => {
    const blue = [sessionEntity({ id: 'a', state: 'ready-for-review' })];
    const first = watchSessions(null, blue, T0);
    expect(first.done).toEqual([]);
    expect(watchSessions(first.watches, blue, T0 + MINUTE).done).toEqual([]);
  });

  it('is told again for the next turn', () => {
    let look = watchSessions(null, [sessionEntity({ id: 'a', state: 'ready-for-review' })], T0);
    look = watchSessions(look.watches, [sessionEntity({ id: 'a', state: 'working' })], T0 + MINUTE);
    look = watchSessions(
      look.watches,
      [sessionEntity({ id: 'a', state: 'ready-for-review' })],
      T0 + 2 * MINUTE,
    );
    expect(look.done.map((s) => s.id)).toEqual(['a']);
  });
});

describe('a session left waiting', () => {
  it('is told once it has needed the reader for thirty minutes, and only once', () => {
    let look = watchSessions(null, [sessionEntity({ id: 'a', state: 'working' })], T0);
    const blue = [sessionEntity({ id: 'a', state: 'ready-for-review' })];
    look = watchSessions(look.watches, blue, T0 + MINUTE);
    look = watchSessions(look.watches, blue, T0 + MINUTE + STALE_AFTER_MS - 1);
    expect(look.stale).toEqual([]);
    look = watchSessions(look.watches, blue, T0 + MINUTE + STALE_AFTER_MS);
    expect(look.stale.map((s) => s.id)).toEqual(['a']);
    look = watchSessions(look.watches, blue, T0 + MINUTE + 2 * STALE_AFTER_MS);
    expect(look.stale).toEqual([]);
  });

  it("counts from the host's word for when the wait began", () => {
    const waiting = [
      sessionEntity({
        id: 'a',
        state: 'waiting-on-you',
        observedSince: new Date(T0 - STALE_AFTER_MS + MINUTE),
      }),
    ];
    let look = watchSessions(
      null,
      [sessionEntity({ id: 'a', state: 'working' })],
      T0 - 2 * STALE_AFTER_MS,
    );
    look = watchSessions(look.watches, waiting, T0);
    expect(look.stale).toEqual([]);
    look = watchSessions(look.watches, waiting, T0 + MINUTE);
    expect(look.stale.map((s) => s.id)).toEqual(['a']);
  });

  it('is not told for a session already long waiting when the console opened', () => {
    const waiting = [
      sessionEntity({ id: 'a', state: 'waiting-on-you', observedSince: new Date(T0 - 3_600_000) }),
    ];
    const first = watchSessions(null, waiting, T0);
    expect(watchSessions(first.watches, waiting, T0 + MINUTE).stale).toEqual([]);
  });

  it('is never told for an idle or working session', () => {
    let look = watchSessions(
      null,
      [sessionEntity({ id: 'a', state: 'idle' }), sessionEntity({ id: 'b', state: 'working' })],
      T0,
    );
    look = watchSessions(
      look.watches,
      [sessionEntity({ id: 'a', state: 'idle' }), sessionEntity({ id: 'b', state: 'working' })],
      T0 + 2 * STALE_AFTER_MS,
    );
    expect(look.stale).toEqual([]);
  });

  it('does not count from an old observation a failure carries over', () => {
    // A session that fails keeps the agent's observedSince from long before.
    const since = new Date(T0 - 40 * MINUTE);
    let look = watchSessions(
      null,
      [sessionEntity({ id: 'a', state: 'working', observedSince: since })],
      T0,
    );
    const failed = [sessionEntity({ id: 'a', state: 'waiting-on-you', observedSince: since })];
    look = watchSessions(look.watches, failed, T0 + MINUTE);
    expect(look.stale).toEqual([]);
    look = watchSessions(look.watches, failed, T0 + MINUTE + STALE_AFTER_MS - 1);
    expect(look.stale).toEqual([]);
    look = watchSessions(look.watches, failed, T0 + MINUTE + STALE_AFTER_MS);
    expect(look.stale.map((s) => s.id)).toEqual(['a']);
  });

  it('includes a launch stuck in starting, which waits on the reader', () => {
    const stuck = [sessionEntity({ id: 'a', lifecycle: 'starting', state: 'waiting-on-you' })];
    let look = watchSessions(
      null,
      [sessionEntity({ id: 'a', lifecycle: 'starting', state: 'idle' })],
      T0,
    );
    look = watchSessions(look.watches, stuck, T0 + MINUTE);
    look = watchSessions(look.watches, stuck, T0 + MINUTE + STALE_AFTER_MS);
    expect(look.stale.map((s) => s.id)).toEqual(['a']);
  });
});
