import type { HostEntity, SessionEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import { mostUrgent, sessionStateOf, type TaskSessionState } from './session-state';

export interface SessionLine {
  sessionId: string;
  name: string;
  state: TaskSessionState;
  /** How many other sessions the task has. */
  others: number;
}

export interface TaskSession {
  session: SessionEntity;
  state: TaskSessionState;
}

/**
 * The task's sessions the console can see, each with its state. A link to a
 * session the list no longer has (deleted elsewhere) is left out. Without
 * the hosts, a session still starting reads as running rather than queued.
 */
export function taskSessionsOf(
  task: TaskEntity,
  sessions: ReadonlyMap<string, SessionEntity>,
  hosts: ReadonlyMap<string, HostEntity> = new Map(),
): TaskSession[] {
  return task.sessions.flatMap((link) => {
    const session = sessions.get(link.sessionId);
    if (!session) return [];
    const host = session.hostId ? hosts.get(session.hostId) : undefined;
    return [{ session, state: sessionStateOf(session, host?.online) }];
  });
}

/** The line a list of a task's sessions shows: the one that most needs the person. */
function sessionLineFrom(known: readonly TaskSession[]): SessionLine | null {
  const first = mostUrgent(known);
  if (!first) return null;
  return {
    sessionId: first.session.id,
    name: first.session.name,
    state: first.state,
    others: known.length - 1,
  };
}

/** The card's session line: of the task's sessions the console can see, the one that most needs the person. */
export function sessionLineOf(
  task: TaskEntity,
  sessions: ReadonlyMap<string, SessionEntity>,
  hosts: ReadonlyMap<string, HostEntity>,
): SessionLine | null {
  return sessionLineFrom(taskSessionsOf(task, sessions, hosts));
}
