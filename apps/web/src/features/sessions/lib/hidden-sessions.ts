import type { SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The sessions the sidebar lists: every one while the reader shows hidden
 * sessions, the rest otherwise, and how many are hidden either way, for the
 * filter menu's toggle. Unlike a hidden project, a hidden session is the
 * API's (`SessionEntity.hidden`): a bot or a script can start one hidden, and
 * every device agrees on it.
 */
export function listedSessions(sessions: readonly SessionEntity[], showHidden: boolean) {
  const hiddenCount = sessions.filter((session) => session.hidden).length;
  return {
    sessions: showHidden ? [...sessions] : sessions.filter((session) => !session.hidden),
    hiddenCount,
  };
}
