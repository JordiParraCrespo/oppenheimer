import type { StatusState } from '@oppenheimer/design-system-web';
import type { TaskSessionState } from '@oppenheimer/frontend-consumer';

/** Each state on the design system's run-state dot. */
export const SESSION_STATUS: Record<TaskSessionState, StatusState> = {
  waiting: 'needs-input',
  queued: 'queued',
  running: 'running',
  failed: 'failed',
  idle: 'idle',
  completed: 'completed',
};
