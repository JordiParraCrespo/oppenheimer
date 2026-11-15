import { type SessionEntity, stateWordFor } from '@oppenheimer/frontend-consumer';

/** The chips over the Sessions tab, as the export draws them. */
export const SESSION_FILTERS = ['all', 'needs-input', 'running', 'failed'] as const;
export type SessionFilter = (typeof SESSION_FILTERS)[number];

/** Each chip's name: the console's own words for those states. */
export const FILTER_LABEL = {
  all: 'sessions.filters.shownAll',
  'needs-input': 'sessions.session.state.waiting-on-you',
  running: 'sessions.session.state.working',
  failed: 'sessions.session.state.failed',
} as const satisfies Record<SessionFilter, string>;

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

const PREDICATE: Record<SessionFilter, (session: SessionEntity) => boolean> = {
  all: () => true,
  'needs-input': needsInput,
  running: isRunning,
  failed: isFailed,
};

export function matchesFilter(session: SessionEntity, filter: SessionFilter): boolean {
  return PREDICATE[filter](session);
}

/** How many sessions each chip would show, for the count beside its name. */
export function filterCounts(sessions: readonly SessionEntity[]): Record<SessionFilter, number> {
  const counts: Record<SessionFilter, number> = { all: 0, 'needs-input': 0, running: 0, failed: 0 };
  for (const session of sessions) {
    for (const filter of SESSION_FILTERS) {
      if (PREDICATE[filter](session)) counts[filter] += 1;
    }
  }
  return counts;
}

export type SessionDotTone = 'waiting' | 'running' | 'failed' | 'idle';

/** The dot beside a row, decided by the same predicates as the chips. */
export function dotOf(session: SessionEntity): SessionDotTone {
  if (needsInput(session)) return 'waiting';
  if (isFailed(session)) return 'failed';
  if (isRunning(session)) return 'running';
  return 'idle';
}

/**
 * The first word of a row's line under its project: a delete its host refused
 * says so, since that is why it is red; any other session says its state.
 */
export function leadKeyOf(session: SessionEntity) {
  return session.closeRefusal
    ? ('sessions.sidebar.notDeleted' as const)
    : (`sessions.session.state.${stateWordFor(session)}` as const);
}

/** What the person is being asked, for the line under a waiting session's name. */
export function askOf(session: SessionEntity): string | null {
  const decision = session.decision;
  if (decision?.kind === 'question') return decision.questions[0]?.question ?? null;
  if (decision?.kind === 'permission') return decision.detail ?? decision.title;
  return session.agentReport?.message ?? null;
}
