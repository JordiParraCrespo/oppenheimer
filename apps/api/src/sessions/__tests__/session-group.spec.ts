import { describe, expect, it } from 'vitest';
import {
  type AgentObservation,
  agentObservationFrom,
  SESSION_GROUP_DISPLAY_ORDER,
  type SessionGroupInput,
  type SessionReview,
  sessionGroup,
} from '../domain/session-group.policy';
import {
  INITIAL_SESSION_FOLD,
  SESSION_EVENT_KINDS,
  type SessionFold,
  type SessionLogEntry,
} from '../domain/session-state.policy';

/**
 * The derived group is what the sidebar dot shows, and its four `waiting-on-you`
 * sources are the part that earns the whole vocabulary: a sidebar organised by what
 * needs you is only useful if "needs you" is more than "failed".
 *
 * The debounce is the other half, and it is the one with a security shape: a caller
 * with no recorded history must not be able to claim a session has been blocked for
 * five minutes and pull it to the top of somebody's list.
 */

const NOW = new Date('2026-09-19T12:00:00Z');
const secondsAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

function fold(overrides: Partial<SessionFold> = {}): SessionFold {
  return { ...INITIAL_SESSION_FOLD, lastEventAt: secondsAgo(5), ...overrides };
}

function input(overrides: Partial<SessionGroupInput> = {}): SessionGroupInput {
  return {
    fold: fold(),
    observation: null,
    review: null,
    paneMissing: false,
    ...overrides,
  };
}

const review = (overrides: Partial<SessionReview> = {}): SessionReview => ({
  reportHash: null,
  ackedReportHash: null,
  branchPushed: false,
  pullRequestOpen: false,
  pullRequestApproved: false,
  pullRequestMerged: false,
  ...overrides,
});

describe('the four waiting-on-you sources', () => {
  it('a failed session', () => {
    expect(sessionGroup(input({ fold: fold({ state: 'failed' }) }), NOW)).toBe('waiting-on-you');
  });

  it('an agent blocked for thirty seconds', () => {
    const observation: AgentObservation = { state: 'blocked', since: secondsAgo(31) };
    expect(sessionGroup(input({ fold: fold({ state: 'open' }), observation }), NOW)).toBe(
      'waiting-on-you',
    );
  });

  it('a launch that has sat unready for a minute', () => {
    expect(
      sessionGroup(input({ fold: fold({ state: 'starting', lastEventAt: secondsAgo(61) }) }), NOW),
    ).toBe('waiting-on-you');
  });

  it('a pane that is gone with no report', () => {
    expect(sessionGroup(input({ fold: fold({ state: 'open' }), paneMissing: true }), NOW)).toBe(
      'waiting-on-you',
    );
  });

  it('but not a session somebody stopped on purpose', () => {
    // A stop the person asked for is the same row with `stoppedAt` set, and that is
    // idle rather than a fault.
    expect(
      sessionGroup(
        input({ fold: fold({ state: 'open', stoppedAt: secondsAgo(10) }), paneMissing: true }),
        NOW,
      ),
    ).toBe('idle');
  });

  it('and not a launch that has already been observed ready', () => {
    const observation: AgentObservation = { state: 'idle', since: secondsAgo(80) };
    expect(
      sessionGroup(
        input({ fold: fold({ state: 'starting', lastEventAt: secondsAgo(90) }), observation }),
        NOW,
      ),
    ).toBe('idle');
  });
});

describe('the debounce', () => {
  it('claims nothing from a single report, however old the clock says it is', () => {
    // `since: null` is what the fold records for the first sighting of a state. A
    // caller with no history cannot fabricate a duration out of it.
    const observation: AgentObservation = { state: 'blocked', since: null };
    expect(sessionGroup(input({ fold: fold({ state: 'open' }), observation }), NOW)).toBe('idle');
  });

  it('does not fire one second early', () => {
    const observation: AgentObservation = { state: 'blocked', since: secondsAgo(29) };
    expect(sessionGroup(input({ fold: fold({ state: 'open' }), observation }), NOW)).toBe('idle');
  });

  it('accumulates across repeated reports of the same state', () => {
    const log: SessionLogEntry[] = [
      {
        seq: 1,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'blocked' },
        occurredAt: secondsAgo(90),
      },
      {
        seq: 2,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'blocked' },
        occurredAt: secondsAgo(60),
      },
      {
        seq: 3,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'blocked' },
        occurredAt: secondsAgo(5),
      },
    ];
    const observation = agentObservationFrom(log);
    expect(observation?.since).toEqual(secondsAgo(60));
    expect(sessionGroup(input({ fold: fold({ state: 'open' }), observation }), NOW)).toBe(
      'waiting-on-you',
    );
  });

  it('resets when the agent reports something else', () => {
    const log: SessionLogEntry[] = [
      {
        seq: 1,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'blocked' },
        occurredAt: secondsAgo(300),
      },
      {
        seq: 2,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'blocked' },
        occurredAt: secondsAgo(200),
      },
      {
        seq: 3,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'working' },
        occurredAt: secondsAgo(100),
      },
      {
        seq: 4,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'blocked' },
        occurredAt: secondsAgo(2),
      },
    ];
    const observation = agentObservationFrom(log);
    expect(observation).toEqual({ state: 'blocked', since: null });
    expect(sessionGroup(input({ fold: fold({ state: 'open' }), observation }), NOW)).toBe('idle');
  });

  it('ignores an observation the log does not recognise', () => {
    const log: SessionLogEntry[] = [
      {
        seq: 1,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'panicking' },
        occurredAt: NOW,
      },
    ];
    expect(agentObservationFrom(log)).toBeNull();
  });
});

describe('the rest of the vocabulary', () => {
  it('reports working while the agent says it is', () => {
    const observation: AgentObservation = { state: 'working', since: secondsAgo(3) };
    expect(sessionGroup(input({ fold: fold({ state: 'open' }), observation }), NOW)).toBe(
      'working',
    );
  });

  it('reports landing once the pull request is open and approved', () => {
    expect(
      sessionGroup(
        input({
          fold: fold({ state: 'open' }),
          observation: { state: 'done', since: secondsAgo(10) },
          review: review({ branchPushed: true, pullRequestOpen: true, pullRequestApproved: true }),
        }),
        NOW,
      ),
    ).toBe('landing');
  });

  it('reports ready-for-review from a hash comparison, not a read receipt', () => {
    expect(
      sessionGroup(
        input({
          fold: fold({ state: 'open' }),
          observation: { state: 'idle', since: secondsAgo(10) },
          review: review({ reportHash: 'abc', ackedReportHash: null }),
        }),
        NOW,
      ),
    ).toBe('ready-for-review');
  });

  it('falls back to idle once the report has been seen', () => {
    expect(
      sessionGroup(
        input({
          fold: fold({ state: 'open' }),
          observation: { state: 'done', since: secondsAgo(10) },
          review: review({ reportHash: 'abc', ackedReportHash: 'abc' }),
        }),
        NOW,
      ),
    ).toBe('idle');
  });

  it('reports resolved for a closed session whatever else is true of it', () => {
    expect(
      sessionGroup(
        input({
          fold: fold({ state: 'resolved' }),
          observation: { state: 'blocked', since: secondsAgo(600) },
          paneMissing: true,
        }),
        NOW,
      ),
    ).toBe('resolved');
  });
});

describe('precedence and display order are different functions', () => {
  it('lets a thirty-second block outrank an approved pull request', () => {
    // A correctness rule: what needs you now beats what is merely finished.
    expect(
      sessionGroup(
        input({
          fold: fold({ state: 'open' }),
          observation: { state: 'blocked', since: secondsAgo(60) },
          review: review({ branchPushed: true, pullRequestOpen: true, pullRequestApproved: true }),
        }),
        NOW,
      ),
    ).toBe('waiting-on-you');
  });

  it('sorts ready-for-review first, which precedence does not', () => {
    // A UI rule, and the reason it is a separate export: conflate the two and
    // neither can change on its own.
    expect(SESSION_GROUP_DISPLAY_ORDER[0]).toBe('ready-for-review');
    expect(SESSION_GROUP_DISPLAY_ORDER).toHaveLength(6);
  });
});
