import type { TaskSessionState } from '@oppenheimer/frontend-consumer';

/** The dot a task's session line is drawn with, by how the session stands. */
export const SESSION_DOT: Record<TaskSessionState, string> = {
  waiting: 'bg-status-paused',
  queued: 'bg-ink-400',
  running: 'bg-status-active',
  failed: 'bg-destructive',
  idle: 'bg-ink-400',
  completed: 'bg-status-active',
};
