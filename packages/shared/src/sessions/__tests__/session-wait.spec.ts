import { describe, expect, it } from 'vitest';
import { agentTookWorkAfter, isSessionSettled, isWorkSettled } from '../session-wait.js';

/**
 * A client waiting on a session it gave work to (`opp sessions send --wait`,
 * the MCP server's `wait_for_session`) must not take the state the session
 * was in before the work for its outcome: a prompt just sent leaves the
 * session `idle` until the agent is seen on it, and a wait that stopped there
 * reported a task as done before it began (Codex's review of #618).
 */

const observed = (seq: number, state: string) => ({
  seq,
  kind: 'agent.observed',
  payload: { state },
});

describe('isSessionSettled', () => {
  it('waits on a starting or working session, and stops for any other', () => {
    expect(isSessionSettled({ lifecycle: 'starting', state: 'idle' })).toBe(false);
    expect(isSessionSettled({ lifecycle: 'open', state: 'working' })).toBe(false);
    expect(isSessionSettled({ lifecycle: 'open', state: 'ready-for-review' })).toBe(true);
    expect(isSessionSettled({ lifecycle: 'open', state: 'waiting-on-you' })).toBe(true);
    expect(isSessionSettled({ lifecycle: 'failed', state: 'working' })).toBe(true);
  });
});

describe('agentTookWorkAfter', () => {
  it('counts only what the agent was seen doing after the work was given', () => {
    const log = [observed(3, 'working'), { seq: 7, kind: 'prompt.sent', payload: {} }];
    expect(agentTookWorkAfter(log, 7)).toBe(false);
    expect(agentTookWorkAfter([...log, observed(8, 'working')], 7)).toBe(true);
  });

  it('takes an agent stopped on a question as having taken the work', () => {
    expect(agentTookWorkAfter([observed(9, 'blocked')], 7)).toBe(true);
  });

  it('does not take an idle report that raced the prompt for the agent starting on it', () => {
    expect(agentTookWorkAfter([observed(8, 'idle')], 7)).toBe(false);
  });
});

describe('isWorkSettled', () => {
  it('keeps waiting on an idle session until the agent was seen taking the work', () => {
    const idle = { lifecycle: 'open', state: 'idle' };
    expect(isWorkSettled(idle, false)).toBe(false);
    expect(isWorkSettled(idle, true)).toBe(true);
    expect(isWorkSettled({ lifecycle: 'open', state: 'working' }, true)).toBe(false);
  });

  it('stops for a session that ended, whether or not the agent took the work', () => {
    expect(isWorkSettled({ lifecycle: 'failed', state: 'waiting-on-you' }, false)).toBe(true);
    expect(isWorkSettled({ lifecycle: 'resolved', state: 'resolved' }, false)).toBe(true);
  });
});
