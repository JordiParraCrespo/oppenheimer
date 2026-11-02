import { describe, expect, it } from 'vitest';
import type { CloudSessionRecord } from '../session';
import { ingest, needsYouCount } from '../tracker';

const running = (id: string): CloudSessionRecord => ({ id, worker_status: 'running' });
const blocked = (id: string): CloudSessionRecord => ({ id, worker_status: 'requires_action' });
const done = (id: string): CloudSessionRecord => ({
  id,
  worker_status: 'idle',
  status_bucket: 'completed',
});

describe('ingest', () => {
  it('notifies nothing for the first list, but records it', () => {
    const first = ingest({}, [blocked('a'), done('b')], { complete: true, baseline: true });
    expect(first.moved).toEqual([]);
    expect(Object.keys(first.sessions)).toEqual(['a', 'b']);
  });

  it('notifies a session that moves into needing you, once', () => {
    const before = ingest({}, [running('a')], { complete: true, baseline: true }).sessions;
    const after = ingest(before, [blocked('a')], { complete: true, baseline: false });
    expect(after.moved.map((s) => [s.id, s.state])).toEqual([['a', 'needs-input']]);

    const again = ingest(after.sessions, [blocked('a')], { complete: true, baseline: false });
    expect(again.moved).toEqual([]);
  });

  it('does not notify a session that starts running', () => {
    const before = ingest({}, [done('a')], { complete: true, baseline: true }).sessions;
    expect(ingest(before, [running('a')], { complete: true, baseline: false }).moved).toEqual([]);
  });

  it('drops a session missing from a whole list, and keeps it after a single update', () => {
    const before = ingest({}, [running('a'), running('b')], {
      complete: true,
      baseline: true,
    }).sessions;
    expect(
      Object.keys(ingest(before, [running('a')], { complete: true, baseline: false }).sessions),
    ).toEqual(['a']);
    expect(
      Object.keys(
        ingest(before, [running('a')], { complete: false, baseline: false }).sessions,
      ).sort(),
    ).toEqual(['a', 'b']);
  });

  it('drops a session that comes back archived', () => {
    const before = ingest({}, [running('a')], { complete: true, baseline: true }).sessions;
    const after = ingest(before, [{ id: 'a', status: 'archived' }], {
      complete: false,
      baseline: false,
    });
    expect(after.sessions).toEqual({});
  });
});

describe('needsYouCount', () => {
  it('counts what needs input and what failed, nothing else', () => {
    const { sessions } = ingest(
      {},
      [
        blocked('a'),
        { id: 'b', worker_status: 'idle', status_bucket: 'failed' },
        running('c'),
        done('d'),
      ],
      { complete: true, baseline: true },
    );
    expect(needsYouCount(sessions)).toBe(2);
  });
});
