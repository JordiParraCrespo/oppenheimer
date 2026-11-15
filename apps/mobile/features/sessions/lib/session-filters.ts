import type { SessionEntity } from '@oppenheimer/frontend-consumer';

/** The chips over the Sessions tab, as the export draws them. */
export const SESSION_FILTERS = ['all', 'needs-input', 'running', 'failed'] as const;
export type SessionFilter = (typeof SESSION_FILTERS)[number];

/** Whether an agent is waiting on the person: the group the list leads with. */
export function needsInput(session: SessionEntity): boolean {
  return session.state === 'waiting-on-you' && session.isLive && !session.isClosing;
}

function isRunning(session: SessionEntity): boolean {
  return session.state === 'working' && session.isLive && !session.isClosing;
}

function isFailed(session: SessionEntity): boolean {
  return session.lifecycle === 'failed' || session.closeRefusal !== null;
}

export function matchesFilter(session: SessionEntity, filter: SessionFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'needs-input':
      return needsInput(session);
    case 'running':
      return isRunning(session);
    case 'failed':
      return isFailed(session);
  }
}

/** How many sessions each chip would show, for the count beside its name. */
export function filterCounts(sessions: readonly SessionEntity[]): Record<SessionFilter, number> {
  return Object.fromEntries(
    SESSION_FILTERS.map((filter) => [
      filter,
      sessions.filter((session) => matchesFilter(session, filter)).length,
    ]),
  ) as Record<SessionFilter, number>;
}

/** What the person is being asked, for the line under a waiting session's name. */
export function askOf(session: SessionEntity): string | null {
  const decision = session.decision;
  if (decision?.kind === 'question') return decision.questions[0]?.question ?? null;
  if (decision?.kind === 'permission') return decision.detail ?? decision.title;
  return session.agentReport?.message ?? null;
}
