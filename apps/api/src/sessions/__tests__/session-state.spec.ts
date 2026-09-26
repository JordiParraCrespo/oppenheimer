import { describe, expect, it } from 'vitest';
import {
  foldSessionEvent,
  foldSessionLog,
  INITIAL_SESSION_FOLD,
  launchPermissionFor,
  runnerCanStart,
  SESSION_EVENT_KINDS,
  type SessionFold,
  type SessionLogEntry,
} from '../domain/session-state.policy';

/**
 * The fold is the design: `work_session`'s columns are a projection of the log, and
 * the property that makes that claim true is that **replaying any log rebuilds the
 * row**. If a column could ever be written another way, a replay would disagree with
 * it and the log would stop being the truth.
 *
 * So the tests here are mostly properties over generated sequences rather than
 * hand-written transitions: the interesting failures are the orders nobody thought
 * to write down.
 */

let seq = 0;
function entry(
  kind: string,
  payload: unknown = {},
  at = new Date(2026, 8, 19, 12, seq),
): SessionLogEntry {
  seq += 1;
  return { seq, kind, payload, occurredAt: at };
}

const KINDS = Object.values(SESSION_EVENT_KINDS);

/** A deterministic pseudo-random log, so a failure is reproducible from its seed. */
function generateLog(seed: number, length: number): SessionLogEntry[] {
  let state = seed;
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state;
  };
  return Array.from({ length }, () => {
    const kind = KINDS[next() % KINDS.length];
    const payload =
      kind === SESSION_EVENT_KINDS.NAMED
        ? { name: `name-${next() % 100}`, source: next() % 2 === 0 ? 'user' : 'model' }
        : { agentSessionId: `agent-${next() % 10}` };
    return entry(kind, payload);
  });
}

describe('the session fold', () => {
  it('starts a requested session as starting', () => {
    const fold = foldSessionLog([entry(SESSION_EVENT_KINDS.REQUESTED)]);
    expect(fold.state).toBe('starting');
    expect(fold.lastEventAt).not.toBeNull();
  });

  it('opens on the runner’s start and carries the agent’s own session id', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.REQUESTED),
      entry(SESSION_EVENT_KINDS.STARTED, { agentSessionId: 'agent-7' }),
    ]);
    expect(fold.state).toBe('open');
    expect(fold.agentSessionId).toBe('agent-7');
    expect(fold.stateSeq).toBe(1);
  });

  it('leaves the lifecycle alone when a session is stopped', () => {
    // Stopping ends the processes and leaves the worktrees, so the work is exactly
    // as unfinished as it was. `stoppedAt` is the whole of what changes.
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.REQUESTED),
      entry(SESSION_EVENT_KINDS.STARTED),
      entry(SESSION_EVENT_KINDS.STOPPED),
    ]);
    expect(fold.state).toBe('open');
    expect(fold.stoppedAt).not.toBeNull();
  });

  it('clears the stop when the session starts again', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.STARTED),
      entry(SESSION_EVENT_KINDS.STOPPED),
      entry(SESSION_EVENT_KINDS.RESTARTED),
    ]);
    expect(fold.stoppedAt).toBeNull();
    expect(fold.state).toBe('open');
  });

  it('treats a restart request as a request, not an outcome', () => {
    // The control plane must not claim `open` before a host has built anything.
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.REQUESTED),
      entry(SESSION_EVENT_KINDS.RESTART_REQUESTED),
    ]);
    expect(fold.state).toBe('starting');
  });

  it('never leaves resolved, whatever arrives afterwards', () => {
    // The row is a permanent tombstone: a late or replayed `session.started` from a
    // runner that has not heard about the close cannot bring the session back.
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.STARTED),
      entry(SESSION_EVENT_KINDS.CLOSED),
      entry(SESSION_EVENT_KINDS.STARTED),
      entry(SESSION_EVENT_KINDS.RESTARTED),
      entry(SESSION_EVENT_KINDS.FAILED),
    ]);
    expect(fold.state).toBe('resolved');
  });

  it('keeps a name a person typed against a name a model derived', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Fix the wallet list', source: 'user' }),
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Wallet empty state', source: 'model' }),
    ]);
    expect(fold.name).toBe('Fix the wallet list');
    expect(fold.nameSource).toBe('user');
  });

  it('moves the session with the last moved event, and leaves the row’s project alone otherwise', () => {
    expect(foldSessionLog([entry(SESSION_EVENT_KINDS.REQUESTED)]).projectId).toBeNull();
    const moved = foldSessionLog([
      entry(SESSION_EVENT_KINDS.REQUESTED),
      entry(SESSION_EVENT_KINDS.MOVED, { projectId: 'p-2', fromProjectId: 'p-1' }),
      entry(SESSION_EVENT_KINDS.MOVED, { projectId: 'p-3', fromProjectId: 'p-2' }),
      entry(SESSION_EVENT_KINDS.MOVED, {}),
    ]);
    expect(moved.projectId).toBe('p-3');
  });

  it('keeps a name a person typed against the prompt-derived fallback', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Fix the wallet list', source: 'user' }),
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Wallet list empty state', source: 'prompt' }),
    ]);
    expect(fold.name).toBe('Fix the wallet list');
    expect(fold.nameSource).toBe('user');
  });

  it('records a name taken from the prompt’s words as such', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Wallet list empty state', source: 'prompt' }),
    ]);
    expect(fold.nameSource).toBe('prompt');
  });

  it('lets a person rename over a model’s title', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Wallet empty state', source: 'model' }),
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Fix the wallet list', source: 'user' }),
    ]);
    expect(fold.name).toBe('Fix the wallet list');
  });

  it('keeps an unknown kind in the log and advances nothing but the clock', () => {
    // A runner newer than this control plane may log something it has never heard
    // of, and the log has to keep it rather than refuse the batch.
    const before = foldSessionLog([entry(SESSION_EVENT_KINDS.STARTED)]);
    const after = foldSessionEvent(before, entry('agent.thought_about_it'));
    expect(after.state).toBe(before.state);
    expect(after.stateSeq).toBe(before.stateSeq);
    expect(after.lastEventAt).not.toBe(before.lastEventAt);
  });
});

describe('the fold as a property', () => {
  it('rebuilds the same row from the same log, every time', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const log = generateLog(seed, 24);
      expect(foldSessionLog(log)).toEqual(foldSessionLog(log));
    }
  });

  it('is a left fold: replaying from a stored row equals replaying from the start', () => {
    // This is what "the row is the fold" means operationally. Appending to a row
    // read out of the database has to land where a full replay would.
    for (let seed = 1; seed <= 40; seed += 1) {
      const log = generateLog(seed, 24);
      const split = 9;
      const resumed = foldSessionLog(log.slice(split), foldSessionLog(log.slice(0, split)));
      expect(resumed).toEqual(foldSessionLog(log));
    }
  });

  it('only ever reaches a state the stored vocabulary has', () => {
    // `done` and `unknown` are agent observations. Folding one of them onto
    // `SessionState` was the error an earlier draft made.
    for (let seed = 1; seed <= 40; seed += 1) {
      const fold: SessionFold = foldSessionLog(generateLog(seed, 24));
      expect(['starting', 'open', 'failed', 'resolved']).toContain(fold.state);
    }
  });

  it('advances stateSeq exactly as often as the state changes', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const log = generateLog(seed, 24);
      let changes = 0;
      let current = INITIAL_SESSION_FOLD;
      for (const event of log) {
        const next = foldSessionEvent(current, event);
        if (next.state !== current.state) changes += 1;
        current = next;
      }
      expect(current.stateSeq).toBe(changes);
    }
  });
});

/**
 * The launch options, which are the newest columns the fold projects.
 *
 * They exist as columns because a restart must reproduce the launch and the
 * console shows the engine button on a session that already exists — so the
 * property that matters is the same one every other column here has: the log
 * alone rebuilds them (`product/versions/mvp/03-control-plane.md`).
 */
describe('the launch the fold projects', () => {
  it('takes the launch from the request that stated it', () => {
    const fold = foldSessionEvent(
      INITIAL_SESSION_FOLD,
      entry(SESSION_EVENT_KINDS.REQUESTED, {
        launch: { model: 'opus', permission: 'auto', effort: 'high' },
      }),
    );

    expect(fold.launch).toEqual({ model: 'opus', permission: 'auto', effort: 'high' });
    // The request is also what starts the session, and stating a launch must not
    // have cost it that.
    expect(fold.state).toBe('starting');
  });

  it('reads a request with no launch as the level that asks', () => {
    const fold = foldSessionEvent(INITIAL_SESSION_FOLD, entry(SESSION_EVENT_KINDS.REQUESTED, {}));

    expect(fold.launch).toEqual({ model: null, permission: 'ask', effort: null });
  });

  it('refuses a permission level outside the union rather than storing it', () => {
    const fold = foldSessionEvent(
      INITIAL_SESSION_FOLD,
      entry(SESSION_EVENT_KINDS.REQUESTED, {
        launch: { permission: 'root', effort: 'ludicrous' },
      }),
    );

    // `ask` is the safe reading of "unknown": the alternative is a session that
    // asks for nothing, which is not a thing an unreadable log should produce.
    expect(fold.launch.permission).toBe('ask');
    expect(fold.launch.effort).toBeNull();
  });

  it('records no level for a blank terminal, whatever the request carried', () => {
    const fold = foldSessionEvent(
      INITIAL_SESSION_FOLD,
      entry(SESSION_EVENT_KINDS.REQUESTED, {
        agent: 'shell',
        launch: { permission: 'full' },
      }),
    );

    // A level carried over from the last agent the composer had picked means
    // nothing on a shell, and must not be read back as if it did.
    expect(fold.launch.permission).toBeNull();
  });

  it('survives every later entry, because only the request states it', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.REQUESTED, {
        launch: { model: 'sonnet', permission: 'full', effort: 'max' },
      }),
      entry(SESSION_EVENT_KINDS.STARTED, { agentSessionId: 'agent-1' }),
      entry(SESSION_EVENT_KINDS.AGENT_OBSERVED, { state: 'working' }),
      entry(SESSION_EVENT_KINDS.STOPPED),
    ]);

    expect(fold.launch).toEqual({ model: 'sonnet', permission: 'full', effort: 'max' });
  });
});

describe('runnerCanStart', () => {
  const beforeGrok = ['git', 'tmux', 'claude', 'codex', 'opencode'];

  it('refuses an agent whose command the runner never probed', () => {
    expect(runnerCanStart('grok', beforeGrok)).toBe(false);
    expect(runnerCanStart('grok', [...beforeGrok, 'grok'])).toBe(true);
    expect(runnerCanStart('claude-code', beforeGrok)).toBe(true);
  });

  it('allows what it cannot judge: no inventory yet, the blank terminal, an unknown id', () => {
    expect(runnerCanStart('grok', null)).toBe(true);
    expect(runnerCanStart('shell', [])).toBe(true);
    expect(runnerCanStart('cursor', beforeGrok)).toBe(true);
  });
});

describe('launchPermissionFor', () => {
  it('keeps a level for an agent with approvals, and reads an absent one as ask', () => {
    expect(launchPermissionFor('opencode', 'auto')).toBe('auto');
    expect(launchPermissionFor('claude-code', undefined)).toBe('ask');
    expect(launchPermissionFor('codex', 'root')).toBe('ask');
  });

  it('gives the blank terminal no level at all', () => {
    expect(launchPermissionFor('shell', 'full')).toBeNull();
    expect(launchPermissionFor('shell', undefined)).toBeNull();
  });

  it('reads an agent this build does not know as one that asks', () => {
    expect(launchPermissionFor('cursor', null)).toBe('ask');
    expect(launchPermissionFor(null, 'full')).toBe('full');
  });
});
