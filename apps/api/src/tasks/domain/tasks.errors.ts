import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const TaskErrors = {
  /** Also a task in another workspace: the scoped read cannot see it. */
  NOT_FOUND: {
    code: 'TASKS_001',
    message: 'Task not found',
    httpStatus: 404,
  },
  /** Also a goal in another workspace. */
  GOAL_NOT_FOUND: {
    code: 'TASKS_002',
    message: 'Goal not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'TASKS_003',
    message: 'Tasks belong to an organization',
    httpStatus: 400,
  },
  /**
   * The project is missing, archived or in another workspace. Nothing new is
   * filed under a retired project.
   */
  PROJECT_UNAVAILABLE: {
    code: 'TASKS_004',
    message: 'That project cannot take tasks',
    httpStatus: 409,
  },
  /** A session to link that is missing or in another workspace. */
  SESSION_NOT_FOUND: {
    code: 'TASKS_005',
    message: 'Session not found',
    httpStatus: 404,
  },
  /**
   * A move named a task to land after that is not in the target column, or is
   * the task being moved. The board was stale; reloading it shows the column
   * as it is.
   */
  STALE_POSITION: {
    code: 'TASKS_006',
    message: 'That position is no longer on the board',
    httpStatus: 409,
  },
  /** A goal and its project disagree with what the request asked for. */
  GOAL_PROJECT_MISMATCH: {
    code: 'TASKS_007',
    message: 'That goal belongs to another project',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
