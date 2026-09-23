import { describe, expect, it } from 'vitest';
import {
  deriveSessionStartSteps,
  isSessionStartSettled,
  type SessionEvent,
} from '../session-steps';

/**
 * The provisioning pane draws what the host said, and nothing it did not. These
 * are the logs a starting session actually produces, from "the control plane
 * asked" to "the agent is up", plus the two ways it goes wrong.
 */

let seq = 0;
function event(kind: string, payload: unknown = {}, at = 0): SessionEvent {
  seq += 1;
  return { seq, kind, payload, occurredAt: new Date(1_000_000 + at) };
}
const step = (id: string, status: string, at = 0) =>
  event('session.step', { step: id, status }, at);
const states = (events: SessionEvent[]) =>
  deriveSessionStartSteps(events).map((s) => `${s.id}:${s.state}`);

describe('deriveSessionStartSteps', () => {
  it('waits on the host until the host says it has the session', () => {
    expect(states([event('session.requested')])).toEqual([
      'host:running',
      'clone:pending',
      'worktree:pending',
      'agent:pending',
    ]);
  });

  it('moves to the step in hand as each one lands', () => {
    const events = [event('session.requested'), step('host', 'done'), step('clone', 'running')];
    expect(states(events)).toEqual([
      'host:done',
      'clone:running',
      'worktree:pending',
      'agent:pending',
    ]);
  });

  it('treats the next step as running between one landing and the next starting', () => {
    const events = [step('host', 'done'), step('clone', 'running'), step('clone', 'done')];
    expect(states(events)).toEqual([
      'host:done',
      'clone:done',
      'worktree:running',
      'agent:pending',
    ]);
  });

  it('is all done once the session started, even from a runner that logs no steps', () => {
    expect(states([event('session.requested'), event('session.started')])).toEqual([
      'host:done',
      'clone:done',
      'worktree:done',
      'agent:done',
    ]);
  });

  it('marks the step in hand as the one that failed', () => {
    const events = [
      step('host', 'done'),
      step('clone', 'running'),
      event('session.failed', { code: 'SESS_004' }),
    ];
    expect(states(events)).toEqual([
      'host:done',
      'clone:failed',
      'worktree:pending',
      'agent:pending',
    ]);
  });

  it('keeps when each step started and finished, for the durations', () => {
    const steps = deriveSessionStartSteps([
      step('host', 'done', 0),
      step('clone', 'running', 10),
      step('clone', 'done', 1_310),
    ]);
    const clone = steps.find((s) => s.id === 'clone');
    expect(
      clone?.finishedAt && clone.startedAt
        ? clone.finishedAt.getTime() - clone.startedAt.getTime()
        : null,
    ).toBe(1_300);
  });

  it('ignores a step it has never heard of rather than inventing a row', () => {
    const events = [step('host', 'done'), step('warm-cache', 'running')];
    expect(deriveSessionStartSteps(events)).toHaveLength(4);
    expect(states(events)[1]).toBe('clone:running');
  });

  it('reads the log in sequence order, not arrival order', () => {
    const late = step('clone', 'done');
    const early = step('clone', 'running');
    early.seq = late.seq - 1;
    expect(states([late, early, step('host', 'done')])[1]).toBe('clone:done');
  });
});

describe('isSessionStartSettled', () => {
  it('is settled once the log says how the start ended, and not before', () => {
    expect(isSessionStartSettled(undefined)).toBe(false);
    expect(isSessionStartSettled([event('session.requested'), step('clone', 'running')])).toBe(
      false,
    );
    expect(isSessionStartSettled([event('session.started')])).toBe(true);
    expect(isSessionStartSettled([event('session.failed')])).toBe(true);
  });
});
