import { describe, expect, it } from 'vitest';
import { type CloudSessionRecord, classify, nextCursor, sessionList, toTracked } from '../session';

const session = (fields: Partial<CloudSessionRecord>): CloudSessionRecord => ({
  id: 'session_1',
  status: 'active',
  ...fields,
});

describe('classify', () => {
  it('reads a pending permission as needing you, and names the tool', () => {
    expect(
      classify(
        session({
          worker_status: 'requires_action',
          external_metadata: { pending_action: { tool_name: 'Bash' } },
        }),
      ),
    ).toEqual({ state: 'needs-input', reason: { code: 'tool', tool: 'Bash' } });
  });

  it('reads an idle session in the blocked bucket as needing you', () => {
    expect(classify(session({ worker_status: 'idle', status_bucket: 'blocked' })).state).toBe(
      'needs-input',
    );
  });

  it("carries a failed turn's summary as the reason", () => {
    expect(
      classify(
        session({
          worker_status: 'idle',
          status_bucket: 'failed',
          external_metadata: { post_turn_summary: { status_detail: 'tests are red' } },
        }),
      ),
    ).toEqual({ state: 'failed', reason: { code: 'detail', text: 'tests are red' } });
  });

  it('reads a completed turn, and an idle session with no bucket, as done', () => {
    expect(classify(session({ worker_status: 'idle', status_bucket: 'completed' })).state).toBe(
      'done',
    );
    expect(classify(session({ worker_status: 'idle' })).state).toBe('done');
  });

  it('reads a paused session with nothing pending as stopped, not done', () => {
    expect(classify(session({ status: 'paused', worker_status: 'stopped' })).state).toBe('stopped');
  });

  it('keeps a reconnecting session running', () => {
    expect(
      classify(session({ worker_status: 'running', connection_status: 'disconnected' })),
    ).toEqual({ state: 'running', reason: { code: 'reconnecting' } });
  });

  it('reads an environment that never started as failed', () => {
    expect(
      classify(
        session({
          worker_status: 'starting',
          external_metadata: { last_init_error: { message: 'image pull failed' } },
        }),
      ),
    ).toEqual({ state: 'failed', reason: { code: 'detail', text: 'image pull failed' } });
  });

  it('lets archived win over a pending action', () => {
    expect(classify(session({ status: 'archived', worker_status: 'requires_action' })).state).toBe(
      'archived',
    );
  });
});

describe('toTracked', () => {
  it('keeps the title, the repository and the last activity', () => {
    expect(
      toTracked(
        session({
          title: '  Fix   the login ',
          worker_status: 'idle',
          status_bucket: 'completed',
          last_event_at: '2026-10-27T10:00:00Z',
          config: {
            sources: [{ type: 'git_repository', url: 'https://github.com/acme/app.git' }],
          },
        }),
      ),
    ).toEqual({
      id: 'session_1',
      title: 'Fix the login',
      state: 'done',
      reason: null,
      repo: 'acme/app',
      updatedAt: '2026-10-27T10:00:00Z',
    });
  });

  it('drops an archived session', () => {
    expect(toTracked(session({ status: 'archived' }))).toBeNull();
  });
});

describe('sessionList', () => {
  it('finds the records under data, and keeps an empty list a list', () => {
    expect(sessionList({ data: [{ id: 'a', worker_status: 'idle' }] })).toHaveLength(1);
    expect(sessionList({ data: [] })).toEqual([]);
  });

  it('refuses a list of something that is not a session', () => {
    expect(sessionList({ data: [{ id: 'x', name: 'a terminal' }] })).toBeNull();
    expect(sessionList({ id: 'a', worker_status: 'idle' })).toBeNull();
  });
});

describe('nextCursor', () => {
  it('reads where the next page starts, and null on the last page', () => {
    expect(nextCursor({ data: [], next_cursor: 'abc' })).toBe('abc');
    expect(nextCursor({ data: [], has_more: true, last_id: 'session_01x' })).toBe('session_01x');
    expect(nextCursor({ data: [], next_cursor: null })).toBeNull();
    expect(nextCursor({ data: [], has_more: false, last_id: 'session_01x' })).toBeNull();
  });
});
