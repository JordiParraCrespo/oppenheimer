import type { AutomationRunTone } from '@oppenheimer/frontend-consumer';

/** The dot a run's state, or a paused automation, is drawn with: one map for every row that draws one. */
export const RUN_DOT: Record<AutomationRunTone | 'paused', string> = {
  running: 'bg-status-active',
  completed: 'bg-status-active',
  failed: 'bg-destructive',
  paused: 'bg-ink-400',
};
