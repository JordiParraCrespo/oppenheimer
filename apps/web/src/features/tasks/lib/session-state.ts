import type { SessionEntity } from '@oppenheimer/frontend-consumer';

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
