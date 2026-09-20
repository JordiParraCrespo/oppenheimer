import type { SessionGroup } from '@oppenheimer/shared';
import type { SessionFold } from './session-state.policy';

/**
 * The **derived group**: what the sidebar dot shows
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * It is a pure function of the **fold**, which is to say of the row — every input
 * it reads is a column the log projects. That is deliberate and it is what makes
 * the group real on a listing: no caller walks a log to render a dot, and no
 * caller can hand this function an observation the log never recorded.
 *
 * Two rules here are load-bearing and easy to lose:
 *
 *  1. **Debounce is measured from a recorded transition, never a live probe.**
 *     `observedSince` is null until the log has recorded a *second* report of the
 *     same state, and a null `observedSince` means zero seconds — so a caller with
 *     no history cannot fabricate "blocked for five minutes" and move a healthy
 *     session into `waiting-on-you`.
 *  2. **Precedence is a different function from display order.** "Blocked for
 *     thirty seconds beats an approved pull request" is a correctness rule;
 *     "ready-for-review sorts first" is a UI rule. They are {@link sessionGroup}
 *     and {@link SESSION_GROUP_DISPLAY_ORDER}, and conflating them means neither
 *     can change alone.
 *
 * **Two arms have no writer yet, and are not faked.** `waiting-on-you`'s fourth
 * source — the pane is gone with no report — needs the host's own session
 * snapshot, and `landing` needs the pull-request flow to say a branch is pushed,
 * open and approved. Neither exists until the relay and the GitHub experience
 * land, so neither is an input here: a `paneMissing: false` that nothing can ever
 * set to true would be this function pretending to answer a question nobody asked
 * it.
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
