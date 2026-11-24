/**
 * What names one occurrence of a session waiting on a person, wherever it is
 * told: the console's Inbox keys its items by it (a mark applies to one
 * occurrence), and the Chrome extension notifies each occurrence once by it.
 * One owner, so a change to how a wait is named reaches both at once.
 *
 * Zod-free, like the rest of `sessions/`.
 */

/** A session as the sessions list answers it, narrowed to what names its wait. */
export interface SessionOccurrence {
  id: string;
  /** The stored lifecycle: `starting`, `open`, `failed` or `resolved`. */
  lifecycle: string;
  /** When the agent's current state was confirmed: a `Date` in the console, an ISO string on the wire. */
  observedSince: Date | string | null;
  /** How many lifecycle changes the session has had. */
  stateSeq: number;
  /** What the agent waits on, when it says. */
  decision: { id: string } | null;
}

/**
 * A session's wait: a decision its agent waits on by the decision's id, so a
 * follow-up question is a new occurrence; otherwise a blocked agent by the
 * moment it became blocked (`observedSince`); a failed or stuck launch by its
 * lifecycle's change count, since there is no moment a failure began and the
 * next failure is a new change.
 */
export function sessionOccurrenceKey(session: SessionOccurrence): string {
  if (session.decision) return `session:${session.id}:${session.decision.id}`;
  if (session.lifecycle === 'open' && session.observedSince) {
    return `session:${session.id}:${new Date(session.observedSince).toISOString()}`;
  }
  return `session:${session.id}:s${session.stateSeq}`;
}

/** A session's notice by the session and the host's id for it: the next notice is a new occurrence. */
export function noticeOccurrenceKey(sessionId: string, noticeId: string): string {
  return `notice:${sessionId}:${noticeId}`;
}
