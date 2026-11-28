// @vitest-environment node
import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { describe, expect, it } from 'vitest';
import { watchSessions } from '../lib/session-alerts';

/**
 * A turn that ended (the row's dot went blue) is told once, and what was
 * already blue when the console opened is never announced; a break would
 * ring on every load, or never.
 */

describe('a turn that ends', () => {
  it('is told when a working session goes blue, once', () => {
    const first = watchSessions(null, [sessionEntity({ id: 'a', state: 'working' })]);
    const blue = [sessionEntity({ id: 'a', state: 'ready-for-review' })];
    const second = watchSessions(first.watches, blue);
    expect(second.done.map((s) => s.id)).toEqual(['a']);
    expect(watchSessions(second.watches, blue).done).toEqual([]);
  });

  it('is not told for a session already blue when the console opened', () => {
    const blue = [sessionEntity({ id: 'a', state: 'ready-for-review' })];
    const first = watchSessions(null, blue);
    expect(first.done).toEqual([]);
    expect(watchSessions(first.watches, blue).done).toEqual([]);
  });

  it('is told again for the next turn', () => {
    let look = watchSessions(null, [sessionEntity({ id: 'a', state: 'ready-for-review' })]);
    look = watchSessions(look.watches, [sessionEntity({ id: 'a', state: 'working' })]);
    look = watchSessions(look.watches, [sessionEntity({ id: 'a', state: 'ready-for-review' })]);
    expect(look.done.map((s) => s.id)).toEqual(['a']);
  });
});
