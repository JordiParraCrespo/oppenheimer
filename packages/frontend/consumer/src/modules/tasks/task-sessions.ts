import type { HostEntity } from '../hosts';
import type { SessionEntity } from '../sessions';
import type { TaskEntity } from './task.entity';

/**
 * How a card's session line reads a session, in the frames' order of urgency
 * (`Tasks.dc.html`): one that needs the person first, then one at work, a failed
 * one, one idle, one finished. Queued is the console's label for a session still
 * starting on a host that is offline (`19-plan-tasks-and-goals.md` §7).
 */
export type TaskSessionState = 'waiting' | 'queued' | 'running' | 'failed' | 'idle' | 'completed';

const URGENCY: readonly TaskSessionState[] = [
  'waiting',
  'queued',
  'running',
  'failed',
  'idle',
  'completed',
];

export function sessionStateOf(
  session: SessionEntity,
  hostOnline: boolean | undefined,
): TaskSessionState {
  if (session.isResolved) return 'completed';
  if (session.lifecycle === 'failed') return 'failed';
  if (session.isProvisioning) return hostOnline === false ? 'queued' : 'running';
  if (session.state === 'waiting-on-you') return 'waiting';
  if (session.state === 'working' || session.state === 'landing') return 'running';
  return 'idle';
}

/** The most urgent of a task's sessions, the one its card shows. */
export function mostUrgent<T extends { state: TaskSessionState }>(
  sessions: readonly T[],
): T | undefined {
  return [...sessions].sort((a, b) => URGENCY.indexOf(a.state) - URGENCY.indexOf(b.state))[0];
}

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
