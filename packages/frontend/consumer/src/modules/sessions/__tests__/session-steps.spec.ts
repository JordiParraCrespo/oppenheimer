import { describe, expect, it } from 'vitest';
import {
  deriveSessionStartProgress,
  type SessionStartEntry,
  settlesStart,
  toStartEntry,
} from '../session-steps';

/**
 * The provisioning pane draws what the host said, and nothing it did not: a
 * step nobody reported is pending. These are the logs a start produces, from
 * the host receiving the frame to the agent being up, and the ways it fails.
 */

let seq = 0;
const step = (
  id: 'host' | 'clone' | 'worktree' | 'agent',
  status: 'running' | 'done',
  durationMs: number | null = null,
): SessionStartEntry => ({ seq: ++seq, kind: 'step', step: id, status, durationMs });
const started = (): SessionStartEntry => ({ seq: ++seq, kind: 'started' });
const failedEntry = (detail: string | null = null): SessionStartEntry => ({
  seq: ++seq,
  kind: 'failed',
  detail,
  code: null,
});
const states = (entries: SessionStartEntry[], failed = false) =>
  deriveSessionStartProgress(entries, { failed }).steps.map((s) => `${s.id}:${s.state}`);

describe('deriveSessionStartProgress', () => {
  it('draws nothing in hand before the host has said anything', () => {
    expect(states([])).toEqual([
      'host:pending',
      'clone:pending',
      'worktree:pending',
      'agent:pending',
    ]);
  });

  it('shows the step the host says it is on', () => {
    expect(states([step('host', 'running')])).toEqual([
      'host:running',
      'clone:pending',
      'worktree:pending',
      'agent:pending',
    ]);
    expect(
      states([step('host', 'running'), step('host', 'done'), step('clone', 'running')]),
    ).toEqual(['host:done', 'clone:running', 'worktree:pending', 'agent:pending']);
  });

  it('leaves the next step pending until the host reports it', () => {
    expect(states([step('host', 'done'), step('clone', 'running'), step('clone', 'done')])).toEqual(
      ['host:done', 'clone:done', 'worktree:pending', 'agent:pending'],
    );
  });

  it('keeps the duration the host measured, and only once the step landed', () => {
    const { steps } = deriveSessionStartProgress(
      [step('clone', 'running'), step('clone', 'done', 1340), step('worktree', 'running')],
      { failed: false },
    );
    expect(steps.find((s) => s.id === 'clone')?.durationMs).toBe(1340);
    expect(steps.find((s) => s.id === 'worktree')?.durationMs).toBeNull();
  });

  it('is all done and settled once the session started, even from a runner that logs no steps', () => {
    const progress = deriveSessionStartProgress([started()], { failed: false });
    expect(progress.steps.every((s) => s.state === 'done')).toBe(true);
    expect(progress.settled).toBe(true);
  });

  it('fails the step in hand and carries the host’s reason', () => {
    const progress = deriveSessionStartProgress(
      [step('host', 'done'), step('clone', 'running'), failedEntry('clone refused')],
      { failed: true },
    );
    expect(progress.steps.map((s) => `${s.id}:${s.state}`)).toEqual([
      'host:done',
      'clone:failed',
      'worktree:pending',
      'agent:pending',
    ]);
    expect(progress.failure).toEqual({ detail: 'clone refused', code: null });
    expect(progress.settled).toBe(true);
  });

  it('fails the step in hand from the row alone, and waits for the reason', () => {
    // The row turned failed a read before the log page with the reason did.
    const progress = deriveSessionStartProgress([step('host', 'done'), step('clone', 'running')], {
      failed: true,
    });
    expect(progress.steps[1].state).toBe('failed');
    expect(progress.failure).toBeNull();
    expect(progress.settled).toBe(false);
  });

  it('fails the host step when the start was refused before it was accepted', () => {
    expect(states([step('host', 'running'), failedEntry('tmux is missing')], true)[0]).toBe(
      'host:failed',
    );
  });

  it('reads the log in sequence order, not arrival order', () => {
    const running = step('clone', 'running');
    const done = step('clone', 'done', 10);
    expect(states([done, running])[1]).toBe('clone:done');
  });
});

describe('toStartEntry', () => {
  it('parses the runner’s payloads against the shared schema', () => {
    expect(
      toStartEntry({
        seq: 1,
        kind: 'session.step',
        payload: { step: 'clone', status: 'done', durationMs: 5 },
      }),
    ).toEqual({ seq: 1, kind: 'step', step: 'clone', status: 'done', durationMs: 5 });
    expect(
      toStartEntry({ seq: 2, kind: 'session.failed', payload: { detail: ' no repo ' } }),
    ).toEqual({
      seq: 2,
      kind: 'failed',
      detail: 'no repo',
      code: null,
    });
  });

  it('drops a step the schema does not know, and every other kind', () => {
    expect(
      toStartEntry({ seq: 1, kind: 'session.step', payload: { step: 'warm', status: 'done' } }),
    ).toBeNull();
    expect(toStartEntry({ seq: 2, kind: 'agent.observed', payload: {} })).toBeNull();
  });

  it('knows which entries settle a start', () => {
    expect(settlesStart({ seq: 1, kind: 'started' })).toBe(true);
    expect(settlesStart({ seq: 1, kind: 'failed', detail: null, code: null })).toBe(true);
    expect(
      settlesStart({ seq: 1, kind: 'step', step: 'host', status: 'done', durationMs: 1 }),
    ).toBe(false);
  });
});
