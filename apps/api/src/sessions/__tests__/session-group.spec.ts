import { describe, expect, it } from 'vitest';
import { SESSION_GROUP_DISPLAY_ORDER, sessionGroup } from '../domain/session-group.policy';
import {
  foldSessionLog,
  INITIAL_SESSION_FOLD,
  SESSION_EVENT_KINDS,
  type SessionFold,
  type SessionLogEntry,
} from '../domain/session-state.policy';

/**
 * The derived group is what the sidebar dot shows, and the reason it earns a whole
 * vocabulary is that a sidebar organised by what needs you is only useful if "needs
 * you" is more than "failed".
 *
 * Every case here goes through the **fold**, not through a hand-built input object:
 * the group is a function of the row, so a test that could hand it an observation
 * the log never recorded would be testing something the read path cannot do. The
 * debounce is the half with a security shape — a caller with no recorded history
 * must not be able to claim a session has been blocked for five minutes.
 */

const NOW = new Date('2026-09-19T12:00:00Z');
const secondsAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

let seq = 0;
function entry(kind: string, payload: unknown, at: Date): SessionLogEntry {
  seq += 1;
  return { seq, kind, payload, occurredAt: at };
}

const observed = (state: string, at: Date) =>
  entry(SESSION_EVENT_KINDS.AGENT_OBSERVED, { state }, at);

/** A live session: requested, then started. */
function running(...log: SessionLogEntry[]): SessionFold {
  return foldSessionLog([
    entry(SESSION_EVENT_KINDS.REQUESTED, {}, secondsAgo(600)),
    entry(SESSION_EVENT_KINDS.STARTED, {}, secondsAgo(590)),
    ...log,
  ]);
}

describe('the waiting-on-you sources that have a writer', () => {
  it('a failed session', () => {
    expect(sessionGroup(running(entry(SESSION_EVENT_KINDS.FAILED, {}, secondsAgo(5))), NOW)).toBe(
      'waiting-on-you',
    );
  });

  it('an agent blocked for thirty seconds', () => {
    // Two reports: the first records the transition, the second is what gives the
    // duration something to measure from.
    const fold = running(observed('blocked', secondsAgo(90)), observed('blocked', secondsAgo(31)));
    expect(fold.observedSince).toEqual(secondsAgo(31));
    expect(sessionGroup(fold, NOW)).toBe('waiting-on-you');
  });

  it('a launch that has sat unready for a minute', () => {
    const fold = foldSessionLog([entry(SESSION_EVENT_KINDS.REQUESTED, {}, secondsAgo(61))]);
    expect(sessionGroup(fold, NOW)).toBe('waiting-on-you');
  });

  it('but not a session somebody stopped mid-launch', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.REQUESTED, {}, secondsAgo(120)),
      entry(SESSION_EVENT_KINDS.STOPPED, {}, secondsAgo(90)),
    ]);
    expect(sessionGroup(fold, NOW)).toBe('idle');
  });

  it('and not a launch already observed ready', () => {
    const fold = foldSessionLog([
      entry(SESSION_EVENT_KINDS.REQUESTED, {}, secondsAgo(120)),
      observed('idle', secondsAgo(100)),
    ]);
    expect(sessionGroup(fold, NOW)).toBe('idle');
  });
});

describe('the debounce', () => {
  it('claims nothing from a single report, however old the clock says it is', () => {
    // One sighting is not evidence of having been stuck, so the fold leaves
    // `observedSince` null and the group reads zero seconds.
    const fold = running(observed('blocked', secondsAgo(600)));
    expect(fold.observedSince).toBeNull();
    expect(sessionGroup(fold, NOW)).toBe('idle');
  });

  it('does not fire one second early', () => {
    const fold = running(observed('blocked', secondsAgo(90)), observed('blocked', secondsAgo(29)));
    expect(sessionGroup(fold, NOW)).toBe('idle');
  });

  it('accumulates across repeated reports of the same state', () => {
    const fold = running(
      observed('blocked', secondsAgo(300)),
      observed('blocked', secondsAgo(200)),
      observed('blocked', secondsAgo(5)),
    );
    // The transition is what is measured from, not the latest heartbeat.
    expect(fold.observedSince).toEqual(secondsAgo(200));
    expect(sessionGroup(fold, NOW)).toBe('waiting-on-you');
  });

  it('resets when the agent reports something else', () => {
    const fold = running(
      observed('blocked', secondsAgo(300)),
      observed('blocked', secondsAgo(200)),
      observed('working', secondsAgo(100)),
      observed('blocked', secondsAgo(2)),
    );
    expect(fold.observedSince).toBeNull();
    expect(sessionGroup(fold, NOW)).toBe('idle');
  });

  it('ignores an observation the fold does not recognise', () => {
    const fold = running(observed('panicking', secondsAgo(500)));
    expect(fold.lastObservedState).toBeNull();
  });
});

describe('the rest of the vocabulary', () => {
  it('reports working while the agent says it is', () => {
    expect(sessionGroup(running(observed('working', secondsAgo(3))), NOW)).toBe('working');
  });

  it('reports ready-for-review from a hash comparison, not a read receipt', () => {
    const fold = running(
      observed('done', secondsAgo(10)),
      entry(SESSION_EVENT_KINDS.REPORT_PUBLISHED, { hash: 'abc' }, secondsAgo(9)),
    );
    expect(sessionGroup(fold, NOW)).toBe('ready-for-review');
  });

  it('falls back to idle once the report has been read', () => {
    const fold = running(
      entry(SESSION_EVENT_KINDS.REPORT_PUBLISHED, { hash: 'abc' }, secondsAgo(9)),
      entry(SESSION_EVENT_KINDS.REPORT_ACKNOWLEDGED, { hash: 'abc' }, secondsAgo(8)),
    );
    expect(sessionGroup(fold, NOW)).toBe('idle');
  });

  it('reports ready-for-review again when a newer report arrives', () => {
    const fold = running(
      entry(SESSION_EVENT_KINDS.REPORT_PUBLISHED, { hash: 'abc' }, secondsAgo(9)),
      entry(SESSION_EVENT_KINDS.REPORT_ACKNOWLEDGED, { hash: 'abc' }, secondsAgo(8)),
      entry(SESSION_EVENT_KINDS.REPORT_PUBLISHED, { hash: 'def' }, secondsAgo(7)),
    );
    expect(sessionGroup(fold, NOW)).toBe('ready-for-review');
  });

  it('reports resolved for a closed session whatever else is true of it', () => {
    const fold = running(
      observed('blocked', secondsAgo(600)),
      observed('blocked', secondsAgo(500)),
      entry(SESSION_EVENT_KINDS.CLOSED, {}, secondsAgo(4)),
    );
    expect(sessionGroup(fold, NOW)).toBe('resolved');
  });

  it('reports idle for a session nothing has said anything about', () => {
    expect(sessionGroup({ ...INITIAL_SESSION_FOLD, lastEventAt: secondsAgo(5) }, NOW)).toBe('idle');
  });
});

describe('precedence and display order are different functions', () => {
  it('lets a thirty-second block outrank a report nobody has read', () => {
    // A correctness rule: what needs you now beats what is merely finished.
    const fold = running(
      entry(SESSION_EVENT_KINDS.REPORT_PUBLISHED, { hash: 'abc' }, secondsAgo(200)),
      observed('blocked', secondsAgo(180)),
      observed('blocked', secondsAgo(60)),
    );
    expect(sessionGroup(fold, NOW)).toBe('waiting-on-you');
  });

  it('sorts ready-for-review first, which precedence does not', () => {
    // A UI rule, and the reason it is a separate export: conflate the two and
    // neither can change on its own.
    expect(SESSION_GROUP_DISPLAY_ORDER[0]).toBe('ready-for-review');
    expect(SESSION_GROUP_DISPLAY_ORDER).toHaveLength(6);
  });

  it('has no arm it cannot reach — except the two with no writer', () => {
    // `landing` needs the pull-request flow and the fourth `waiting-on-you` source
    // needs the host's snapshot. Neither is faked with a default input, so neither
    // is reachable yet, and this is the test that says so on purpose.
    const reachable = new Set(
      [
        sessionGroup(running(observed('working', secondsAgo(2))), NOW),
        sessionGroup(running(entry(SESSION_EVENT_KINDS.FAILED, {}, secondsAgo(2))), NOW),
        sessionGroup(running(entry(SESSION_EVENT_KINDS.CLOSED, {}, secondsAgo(2))), NOW),
        sessionGroup(
          running(entry(SESSION_EVENT_KINDS.REPORT_PUBLISHED, { hash: 'a' }, secondsAgo(2))),
          NOW,
        ),
        sessionGroup(running(), NOW),
      ].map(String),
    );
    expect([...reachable].sort()).toEqual([
      'idle',
      'ready-for-review',
      'resolved',
      'waiting-on-you',
      'working',
    ]);
  });
});
