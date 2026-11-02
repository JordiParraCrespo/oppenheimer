import {
  type CloudSessionRecord,
  NEEDS_YOU,
  NOTIFIES,
  type TrackedSession,
  toTracked,
} from './session';

export type TrackedSessions = Record<string, TrackedSession>;

/**
 * Fold a batch of session records into what is tracked, and say which
 * sessions moved into a state worth a notification.
 *
 * - `complete`: the batch is the whole list, so a session missing from it was
 *   archived or deleted. A single session, or a later page, is not complete.
 * - `baseline`: the first list after install. Nothing in it notifies — what
 *   was already waiting is not news — but it is recorded, so the next move is.
 */
export function ingest(
  previous: TrackedSessions,
  records: CloudSessionRecord[],
  { complete, baseline }: { complete: boolean; baseline: boolean },
): { sessions: TrackedSessions; moved: TrackedSession[] } {
  const sessions: TrackedSessions = complete ? {} : { ...previous };
  const moved: TrackedSession[] = [];

  for (const record of records) {
    const tracked = toTracked(record);
    if (!tracked) {
      delete sessions[record.id];
      continue;
    }
    sessions[tracked.id] = tracked;
    const before = previous[tracked.id];
    if (!baseline && before?.state !== tracked.state && NOTIFIES.has(tracked.state)) {
      moved.push(tracked);
    }
  }

  return { sessions, moved };
}

export function needsYouCount(sessions: TrackedSessions) {
  return Object.values(sessions).filter((session) => NEEDS_YOU.has(session.state)).length;
}

/** Newest activity first; a session with no time at all goes last. */
export function byRecent(a: TrackedSession, b: TrackedSession) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}
