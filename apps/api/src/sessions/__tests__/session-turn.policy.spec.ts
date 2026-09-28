import { describe, expect, it } from 'vitest';
import { SESSION_EVENT_KINDS, type SessionLogEntry } from '../domain/session-state.policy';
import {
  foldTurnEvent,
  isLiveTurn,
  type SessionTurnFold,
  TURN_EVENT_KINDS,
} from '../domain/session-turn.policy';

let seq = 0;
function entry(kind: string, payload: unknown = {}, at = new Date()): SessionLogEntry {
  seq += 1;
  return { seq, kind, payload, occurredAt: at };
}

function replay(events: SessionLogEntry[], origin: 'person' | 'automation' = 'automation') {
  return events.reduce<SessionTurnFold | null>(
    (turn, event) => foldTurnEvent(turn, event, origin),
    null,
  );
}

const prompt = entry(SESSION_EVENT_KINDS.PROMPT_FIRST, { text: 'Audit the manifests' });
const started = entry(SESSION_EVENT_KINDS.STARTED, {});
const observed = (state: string) => entry(SESSION_EVENT_KINDS.AGENT_OBSERVED, { state });

describe('the turn fold (interactive)', () => {
  it('opens turn one on the first prompt, with the session’s origin', () => {
    const turn = replay([prompt]);
    expect(turn).toMatchObject({ seq: 1, origin: 'automation', state: 'queued' });
    expect(turn?.prompt).toBe('Audit the manifests');
  });

  it('has no turn for a session with no prompt', () => {
    expect(replay([started, observed('working')])).toBeNull();
  });

  it('runs, waits on a person, and completes when the agent goes idle after working', () => {
    const running = replay([prompt, started, observed('working')]);
    expect(running).toMatchObject({ state: 'in_progress', observedWorking: true });
    expect(isLiveTurn(running)).toBe(true);

    const waiting = foldTurnEvent(running, observed('blocked'), 'automation');
    expect(waiting?.state).toBe('requires_action');

    const done = foldTurnEvent(
      foldTurnEvent(waiting, observed('working'), 'automation'),
      observed('idle'),
      'automation',
    );
    expect(done?.state).toBe('completed');
    expect(done?.endedAt).toBeInstanceOf(Date);
    expect(isLiveTurn(done)).toBe(false);
  });

  it('does not call an agent that never worked finished just because it is idle', () => {
    const turn = replay([prompt, started, observed('idle')]);
    expect(turn?.state).toBe('in_progress');
  });

  it('takes the manifest’s own done as finished even with no working seen', () => {
    expect(replay([prompt, started, observed('done')])?.state).toBe('completed');
  });

  it('fails with the session, keeping its detail', () => {
    const turn = replay([
      prompt,
      entry(SESSION_EVENT_KINDS.FAILED, { detail: 'clone refused', code: 'RUNNER_012' }),
    ]);
    expect(turn).toMatchObject({ state: 'failed', failureDetail: 'clone refused' });
  });

  it('is cancelled when the session is stopped under it, and a finished turn is left alone', () => {
    expect(replay([prompt, started, entry(SESSION_EVENT_KINDS.STOPPED)])?.state).toBe('cancelled');
    const done = replay([prompt, started, observed('done'), entry(SESSION_EVENT_KINDS.STOPPED)]);
    expect(done?.state).toBe('completed');
  });

  it('runs a restart of a finished turn as the next turn, by a person', () => {
    const turn = replay([prompt, started, observed('done'), entry(SESSION_EVENT_KINDS.RESTARTED)]);
    expect(turn).toMatchObject({ seq: 2, origin: 'person', state: 'in_progress' });
    expect(turn?.prompt).toBe('Audit the manifests');
  });
});

describe('the turn fold (headless)', () => {
  it('ends on the wrapper’s exit code, whatever the screen said', () => {
    const turn = replay([
      prompt,
      started,
      entry(TURN_EVENT_KINDS.STARTED, { agentSessionId: 'c0ffee' }),
      observed('done'),
      entry(TURN_EVENT_KINDS.ENDED, { exitCode: 1, result: 'tests failed', costUsd: 0.42 }),
    ]);
    expect(turn).toMatchObject({
      drive: 'headless',
      state: 'failed',
      exitCode: 1,
      agentSessionId: 'c0ffee',
      result: 'tests failed',
      costUsd: 0.42,
    });
  });

  it('completes on exit code zero', () => {
    const turn = replay([prompt, entry(TURN_EVENT_KINDS.ENDED, { exitCode: 0 })]);
    expect(turn?.state).toBe('completed');
  });

  it('opens the next turn on a follow-up', () => {
    const first = replay([prompt, entry(TURN_EVENT_KINDS.ENDED, { exitCode: 0 })]);
    const next = foldTurnEvent(
      first,
      entry(TURN_EVENT_KINDS.REQUESTED, { prompt: 'Now open the PR' }),
      'automation',
    );
    expect(next).toMatchObject({ seq: 2, origin: 'follow_up', state: 'queued', drive: 'headless' });
  });
});
