import type { SessionGroup } from '@oppenheimer/shared';
import {
  SESSION_EVENT_KINDS,
  type SessionFold,
  type SessionLogEntry,
} from './session-state.policy';

/**
 * The **derived group**: what the sidebar dot shows, computed on read and never
 * stored (`product/versions/mvp/03-control-plane.md`).
 *
 * It is organised by **what needs you**, which is what a sidebar is for, and it
 * is a third vocabulary rather than a widening of the stored lifecycle: `done`
 * and `unknown` are things the agent reports, and mapping them onto
 * `SessionState` was the error an earlier draft made.
 *
 * Two rules here are load-bearing and easy to lose:
 *
 *  1. **Debounce is measured from a recorded transition, never a live probe.**
 *     `AgentObservation.since` is null until the log has recorded the transition
 *     *into* the observed state, and a null `since` means zero seconds — so a
 *     caller with no history cannot fabricate "blocked for five minutes" and move
 *     a healthy session into `waiting-on-you`.
 *  2. **Precedence is a different function from display order.** "Blocked for
 *     thirty seconds beats an approved pull request" is a correctness rule;
 *     "ready-for-review sorts first" is a UI rule. They are
 *     {@link sessionGroup} and {@link SESSION_GROUP_DISPLAY_ORDER}, and
 *     conflating them means neither can change alone.
 */

/** What the screen manifest reports. An input to the group, never a session state. */
export const AGENT_OBSERVED_STATES = ['working', 'blocked', 'idle', 'done', 'unknown'] as const;

export type AgentObservedState = (typeof AGENT_OBSERVED_STATES)[number];

export interface AgentObservation {
  state: AgentObservedState;
  /**
   * When the transition **into** this state was recorded, or null when the log has
   * only ever seen this state once — which is what makes the debounce below
   * unfakeable.
   */
  since: Date | null;
}

/** Where the work stands on GitHub, as the runner and the pull-request flow report it. */
export interface SessionReview {
  /** A report exists and the person has not looked at this version of it. */
  reportHash: string | null;
  ackedReportHash: string | null;
  branchPushed: boolean;
  pullRequestOpen: boolean;
  pullRequestApproved: boolean;
  pullRequestMerged: boolean;
}

export interface SessionGroupInput {
  fold: SessionFold;
  /** Null when nothing has been observed yet — a session that has only been requested. */
  observation: AgentObservation | null;
  /** Null until the pull-request flow reports on the session's branch. */
  review: SessionReview | null;
  /**
   * The host holds no pane for this session although the control plane thinks it
   * is running — the fourth `waiting-on-you` source. It comes from the runner's
   * own session snapshot, so it is false wherever there is no link to ask.
   */
  paneMissing: boolean;
}

/** The agent has been stuck asking for something for this long. */
const BLOCKED_SECONDS = 30;
/** A launch that has sat in a non-ready state this long is not starting, it is stuck. */
const LAUNCH_SECONDS = 60;

/**
 * Display order for the sidebar, which is deliberately not the precedence order
 * above: what needs you sorts to the top, and "finished and you have not looked"
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
export function sessionGroup(input: SessionGroupInput, now: Date = new Date()): SessionGroup {
  const { fold, observation, review } = input;

  if (fold.state === 'resolved') return 'resolved';
  // A failure is the first of the four `waiting-on-you` sources and outranks
  // everything else: nothing else about the session matters until somebody looks.
  if (fold.state === 'failed') return 'waiting-on-you';

  if (observation?.state === 'blocked' && secondsIn(observation, now) >= BLOCKED_SECONDS) {
    return 'waiting-on-you';
  }

  // The third source: a launch that never became ready. Only while nothing has
  // been observed and nothing has been stopped on purpose — a session somebody
  // stopped mid-launch is idle, not stuck.
  if (
    fold.state === 'starting' &&
    fold.stoppedAt === null &&
    secondsSince(fold.lastEventAt, now) >= LAUNCH_SECONDS &&
    !isReady(observation)
  ) {
    return 'waiting-on-you';
  }

  // The fourth: the pane is gone with no report. A stop the person asked for is
  // the same row with `stoppedAt` set, and that is idle, not a fault.
  if (fold.state === 'open' && input.paneMissing && fold.stoppedAt === null) {
    return 'waiting-on-you';
  }

  if (observation?.state === 'working') return 'working';

  // Landing is the phase after the agent stops: branch pushed, pull request open
  // and approved, not yet merged. Nothing else in the model names it.
  if (
    review?.branchPushed &&
    review.pullRequestOpen &&
    review.pullRequestApproved &&
    !review.pullRequestMerged
  ) {
    return 'landing';
  }

  // Not a state at all: a hash comparison. "Finished and you have not looked"
  // needs no read-receipt table.
  if (review?.reportHash && review.reportHash !== review.ackedReportHash) {
    return 'ready-for-review';
  }

  return 'idle';
}

/**
 * Advance the observation the way {@link foldSessionEvent} advances the row: the
 * recorded transition is what sets `since`, so the debounce is a fact in the log
 * rather than an assertion in a request.
 */
export function foldAgentObservation(
  observation: AgentObservation | null,
  event: SessionLogEntry,
): AgentObservation | null {
  if (event.kind !== SESSION_EVENT_KINDS.AGENT_OBSERVED) return observation;
  const state = observedStateOf(event.payload);
  if (!state) return observation;
  if (observation?.state === state) {
    // The same state again: keep the transition we already recorded, which is
    // what makes a duration accumulate instead of resetting on every heartbeat.
    return { state, since: observation.since ?? event.occurredAt };
  }
  // The first report of a state records the transition but claims no duration
  // yet — one report cannot be evidence of having been stuck.
  return { state, since: null };
}

/** Reduce a log into an observation, which is the replay form of the fold above. */
export function agentObservationFrom(events: readonly SessionLogEntry[]): AgentObservation | null {
  return events.reduce<AgentObservation | null>(foldAgentObservation, null);
}

/** `done` and `idle` both mean "ready for a prompt"; `unknown` counts as not ready. */
function isReady(observation: AgentObservation | null): boolean {
  return observation?.state === 'idle' || observation?.state === 'done';
}

function observedStateOf(payload: unknown): AgentObservedState | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>).state;
  return AGENT_OBSERVED_STATES.includes(value as AgentObservedState)
    ? (value as AgentObservedState)
    : null;
}

function secondsIn(observation: AgentObservation, now: Date): number {
  return secondsSince(observation.since, now);
}

function secondsSince(at: Date | null, now: Date): number {
  if (at === null) return 0;
  return Math.max(0, (now.getTime() - at.getTime()) / 1000);
}
