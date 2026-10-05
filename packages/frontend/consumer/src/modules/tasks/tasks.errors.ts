import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/** Client-side fallbacks, used only when the API answered with no problem document. */
export const TasksErrors = {
  FETCH_LIST_FAILED: { code: 'TASKS_CLIENT_001', message: 'Failed to load the board' },
  SAVE_FAILED: { code: 'TASKS_CLIENT_002', message: 'Failed to save the task' },
  MOVE_FAILED: { code: 'TASKS_CLIENT_003', message: 'Failed to move the task' },
  DELETE_FAILED: { code: 'TASKS_CLIENT_004', message: 'Failed to delete the task' },
  START_SESSION_FAILED: { code: 'TASKS_CLIENT_005', message: 'Failed to start the session' },
  LINK_FAILED: { code: 'TASKS_CLIENT_006', message: 'Failed to link the session' },
  FETCH_GOALS_FAILED: { code: 'TASKS_CLIENT_007', message: 'Failed to load the goals' },
  SAVE_GOAL_FAILED: { code: 'TASKS_CLIENT_008', message: 'Failed to save the goal' },
  DELETE_GOAL_FAILED: { code: 'TASKS_CLIENT_009', message: 'Failed to delete the goal' },
} as const satisfies Record<string, ErrorDefinition>;
