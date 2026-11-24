import { describe, expect, it } from 'vitest';
import {
  consoleOrigin,
  newWaits,
  type RunnerSessionRow,
  runnerSessionPage,
  runnerSessionsUrl,
  runnerWaits,
  sessionPageUrl,
  waitingCount,
} from '../runner';

/**
 * The sessions on the person's own hosts, read from their Oppenheimer API:
 * each one that comes to wait on them, and each notice an agent sends, is
 * told once, keyed as the console's Inbox keys it. Before, the extension told
 * only about Claude Code cloud sessions, so a Codex approval on the person's
 * laptop waited unseen unless the console was open.
 */
const row = (id: string, patch: Partial<RunnerSessionRow> = {}): RunnerSessionRow => ({
  id,
  name: `Session ${id}`,
  state: 'working',
  lifecycle: 'open',
  observedSince: null,
  stateSeq: 3,
  cloudSessionId: null,
  decision: null,
  notice: null,
  ...patch,
});
const waiting = (id: string, since = '2026-11-24T09:00:00.000Z') =>
  row(id, { state: 'waiting-on-you', observedSince: since });
const connection = { apiUrl: 'https://api.example.com', token: 't' };

describe('what a runner session waits on the person for', () => {
  it('a waiting session, keyed by its decision when the agent asked one', () => {
    const asked = { ...waiting('a'), decision: { id: 'd1' } };
    expect(runnerWaits([asked])).toEqual([
      { key: 'session:a:d1', sessionId: 'a', name: 'Session a', kind: 'waiting' },
    ]);
  });

  it('a waiting session with no decision, keyed by when it blocked', () => {
    expect(runnerWaits([waiting('a')])[0]?.key).toBe('session:a:2026-11-24T09:00:00.000Z');
  });

  it('a failed session, keyed by its change count', () => {
    const failed = row('a', { state: 'waiting-on-you', lifecycle: 'failed', stateSeq: 7 });
    expect(runnerWaits([failed])).toEqual([
      { key: 'session:a:s7', sessionId: 'a', name: 'Session a', kind: 'failed' },
    ]);
  });

  it("an agent's notice, with its words", () => {
    const told = row('a', { notice: { id: 'n1', text: 'The migration ran' } });
    expect(runnerWaits([told])).toEqual([
      {
        key: 'notice:a:n1',
        sessionId: 'a',
        name: 'Session a',
        kind: 'notice',
        text: 'The migration ran',
      },
    ]);
  });

  it('nothing for a working session, nor for a cloud run the extension already tracks', () => {
    expect(runnerWaits([row('a'), { ...waiting('b'), cloudSessionId: 'session_01x' }])).toEqual([]);
  });

  it('counts sessions waiting, not notices, on the badge', () => {
    const waits = runnerWaits([
      { ...waiting('a'), notice: { id: 'n', text: 'hi' } },
      waiting('b'),
      row('c', { notice: { id: 'n2', text: 'done' } }),
    ]);
    expect(waitingCount(waits)).toBe(2);
  });
});

describe('telling each wait once', () => {
  it('tells nothing on the first look, so connecting does not announce the backlog', () => {
    const first = newWaits(null, runnerWaits([waiting('a')]));
    expect(first.fresh).toEqual([]);
    expect(first.seen).toEqual(['session:a:2026-11-24T09:00:00.000Z']);
  });

  it('tells a session that comes to wait, then not again while it waits', () => {
    const first = newWaits(null, runnerWaits([row('a')]));
    const second = newWaits(first.seen, runnerWaits([waiting('a')]));
    expect(second.fresh.map((wait) => wait.sessionId)).toEqual(['a']);
    expect(newWaits(second.seen, runnerWaits([waiting('a')])).fresh).toEqual([]);
  });

  it('tells a new wait on the same session again', () => {
    const before = newWaits(null, runnerWaits([waiting('a', '2026-11-24T09:00:00.000Z')]));
    const after = newWaits(before.seen, runnerWaits([waiting('a', '2026-11-24T09:30:00.000Z')]));
    expect(after.fresh).toHaveLength(1);
  });
});

describe('the API and the console', () => {
  it('reads the open sessions, a hundred a page, from the origin connected', () => {
    expect(runnerSessionsUrl({ ...connection, apiUrl: 'https://api.example.com/x' }, 'c1')).toBe(
      'https://api.example.com/api/v1/sessions?resolved=false&limit=100&cursor=c1',
    );
  });

  it('takes a page of rows and its cursor, and refuses what is not a list', () => {
    expect(runnerSessionPage({ data: [row('a'), { nope: 1 }], meta: { nextCursor: 'n' } })).toEqual(
      {
        rows: [row('a')],
        nextCursor: 'n',
      },
    );
    expect(runnerSessionPage({ data: [], meta: { nextCursor: null } })?.nextCursor).toBeNull();
    expect(runnerSessionPage({ type: 'about:blank', status: 401 })).toBeNull();
  });

  it('opens a session where the person said the console is', () => {
    expect(sessionPageUrl({ ...connection, consoleUrl: 'https://console.acme.dev/x' }, 'a b')).toBe(
      'https://console.acme.dev/sessions/a%20b',
    );
  });

  it('works out the console from the API when it was not given', () => {
    expect(consoleOrigin({ apiUrl: 'http://localhost:3001', token: 't' })).toBe(
      'http://localhost:3000',
    );
    expect(consoleOrigin(connection)).toBe('https://app.example.com');
    expect(consoleOrigin({ apiUrl: 'https://oppenheimer.acme.dev', token: 't' })).toBe(
      'https://oppenheimer.acme.dev',
    );
  });
});
