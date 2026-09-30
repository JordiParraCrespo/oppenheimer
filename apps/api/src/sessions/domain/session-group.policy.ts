import type { SessionGroup } from '@oppenheimer/shared';
import type { SessionFold } from './session-state.policy';

/**
 * The **derived group**: what the sidebar dot shows
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * A pure function of the **fold**, i.e. of the row: every input is a column the log
 * projects, so a listing renders a dot without walking a log and no caller can hand
 * it an observation the log never recorded. Two rules are load-bearing:
 *
 *  1. **Debounce is measured from a recorded transition, never a live probe.**
 *     `observedSince` is null until the log records a *second* report of the same
 *     state, and null means zero seconds, so a caller with no history cannot
 *     fabricate "blocked for five minutes" into `waiting-on-you`.
 *  2. **Precedence is not display order.** "Blocked for thirty seconds beats an
 *     approved pull request" is a correctness rule, "ready-for-review sorts first" a
 *     UI rule: {@link sessionGroup} and {@link SESSION_GROUP_DISPLAY_ORDER}, kept
 *     apart so each can change alone.
 *
 * **Two arms have no writer yet, and are not faked.** `waiting-on-you`'s fourth
 * source is a pane gone with no report, but `SessionReconciliationResolver` records a
 * lost session as `stopped` and nothing flags it. `landing` needs a branch pushed,
 * open and approved, and today's GitHub pull-request events feed automations, not
 * sessions. An input nothing can set would be this function pretending.
 */

/** The agent has been stuck asking for something for this long. */
const BLOCKED_SECONDS = 30;
/** A launch that has sat in a non-ready state this long is not starting, it is stuck. */
const LAUNCH_SECONDS = 60;

/**
 * Display order for the sidebar, which is deliberately not the precedence order
 * below: what needs you sorts to the top, and "finished and you have not looked"
 * sorts above "waiting", because it is the one a person can close out.
 */
export const SESSION_GROUP_DISPLAY_ORDER: readonly SessionGroup[] = [
  'ready-for-review',
  'waiting-on-you',
  'working',
  'landing',
  'idle',
  'resolved',
];

/** The group, by precedence. `now` is a parameter so the function stays pure. */
export function sessionGroup(fold: SessionFold, now: Date = new Date()): SessionGroup {
  if (fold.state === 'resolved') return 'resolved';
  // A failure is the first of `waiting-on-you`'s sources and outranks everything
  // else: nothing about the session matters until somebody looks.
  if (fold.state === 'failed') return 'waiting-on-you';

  // The second: an agent that has been asking for something for half a minute.
  if (
    fold.lastObservedState === 'blocked' &&
    secondsSince(fold.observedSince, now) >= BLOCKED_SECONDS
  ) {
    return 'waiting-on-you';
  }

  // The third: a launch that never became ready. Only while nothing has been
  // stopped on purpose — a session somebody stopped mid-launch is idle, not stuck.
  if (
    fold.state === 'starting' &&
    fold.stoppedAt === null &&
    secondsSince(fold.lastEventAt, now) >= LAUNCH_SECONDS &&
    !isReady(fold)
  ) {
    return 'waiting-on-you';
  }

  if (fold.lastObservedState === 'working') return 'working';

  // Not a state at all: a hash comparison. "Finished and you have not looked"
  // needs no read-receipt table.
  if (fold.reportHash && fold.reportHash !== fold.ackedReportHash) return 'ready-for-review';

  return 'idle';
}

/** `done` and `idle` both mean "ready for a prompt"; `unknown` counts as not ready. */
function isReady(fold: SessionFold): boolean {
  return fold.lastObservedState === 'idle' || fold.lastObservedState === 'done';
}

function secondsSince(at: Date | null, now: Date): number {
  if (at === null) return 0;
  return Math.max(0, (now.getTime() - at.getTime()) / 1000);
}
