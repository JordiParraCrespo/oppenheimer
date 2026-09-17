import { describe, expect, it } from 'vitest';
import { SessionEntity, type SessionState } from '../session.entity';

function session(state: SessionState): SessionEntity {
  return new SessionEntity(
    'session-1',
    'fix-login',
    'host-1',
    'acme/console',
    'main',
    'fix-login',
    'claude-code',
    state,
    new Date('2026-06-15T12:00:00Z'),
  );
}

/** The terminal attaches only to a session whose tmux is still there. */
describe('SessionEntity.isLive', () => {
  it('is true while the session is running or idle', () => {
    expect(session('running').isLive).toBe(true);
    expect(session('idle').isLive).toBe(true);
  });

  it('is false before the worktree exists and after it is gone', () => {
    expect(session('starting').isLive).toBe(false);
    expect(session('stopped').isLive).toBe(false);
    expect(session('failed').isLive).toBe(false);
  });
});
