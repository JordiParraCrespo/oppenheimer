import type { HostEntity, SessionEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import { mostUrgent, sessionStateOf, type TaskSessionState } from './session-state';

export interface SessionLine {
  sessionId: string;
  name: string;
  state: TaskSessionState;
  /** How many other sessions the task has. */
  others: number;
}

/**
 * The card's session line: of the task's sessions the console can see, the one
 * that most needs the person. A link to a session the list no longer has
 * (deleted elsewhere) is not drawn.
 */
export function sessionLineOf(
  task: TaskEntity,
  sessions: ReadonlyMap<string, SessionEntity>,
  hosts: ReadonlyMap<string, HostEntity>,
): SessionLine | null {
  const known = task.sessions.flatMap((link) => {
    const session = sessions.get(link.sessionId);
    if (!session) return [];
    const host = session.hostId ? hosts.get(session.hostId) : undefined;
    return [{ session, state: sessionStateOf(session, host?.online) }];
  });
  const first = mostUrgent(known);
  if (!first) return null;
  return {
    sessionId: first.session.id,
    name: first.session.name,
    state: first.state,
    others: known.length - 1,
  };
}
