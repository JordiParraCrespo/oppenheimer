import { SessionEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { mostUrgent, sessionStateOf } from '../lib/session-state';

function session(lifecycle: SessionEntity['lifecycle'], state: SessionEntity['state'] = 'working') {
  return new SessionEntity(
    's-1',
    'org-1',
    'p-1',
    'h-1',
    'Fix the list',
    'bold-otter',
    'claude-code',
    { model: null, permission: null, effort: null },
    state,
    lifecycle,
    null,
    [],
    null,
    [],
    new Date('2026-10-01T00:00:00Z'),
  );
}

/**
 * Queued is the console's word, not a session state the API stores
 * (`19-plan-tasks-and-goals.md` §7): a session still starting on a host that is
 * offline. The card shows whichever of a task's sessions most needs the person.
 */
describe('a card’s session line', () => {
  it('calls a session starting on an offline host Queued, and one on a live host Running', () => {
    expect(sessionStateOf(session('starting'), false)).toBe('queued');
    expect(sessionStateOf(session('starting'), true)).toBe('running');
  });

  it('reads the derived group for an open session, and Completed once it is resolved', () => {
    expect(sessionStateOf(session('open', 'waiting-on-you'), true)).toBe('waiting');
    expect(sessionStateOf(session('open', 'idle'), true)).toBe('idle');
    expect(sessionStateOf(session('resolved', 'idle'), true)).toBe('completed');
    expect(sessionStateOf(session('failed'), true)).toBe('failed');
  });

  it('shows the one that needs the person first', () => {
    const states = [
      { state: 'idle' as const },
      { state: 'waiting' as const },
      { state: 'running' as const },
    ];
    expect(mostUrgent(states)?.state).toBe('waiting');
  });
});
