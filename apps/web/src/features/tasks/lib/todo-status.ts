import { type StatusState, TASK_STATUS_STATE } from '@oppenheimer/design-system-web';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import type { TaskSession } from './session-line';
import { SESSION_STATUS, type TaskSessionState } from './session-state';
import type { TodoMark, TodoPlace } from './todo';

// Apart from `todo.ts`: the sidebar's count reads that file, and the design
// system's dots would put the board's drag layer in the first load.

/** The dot a mark wears when no session stands for it: its session state's, or the In review column's. */
const MARK_DOT = {
  waiting: SESSION_STATUS.waiting,
  failed: SESSION_STATUS.failed,
  review: TASK_STATUS_STATE.review,
  stopped: SESSION_STATUS.idle,
} as const satisfies Record<TodoMark, StatusState>;

/** The words a row's status says, as a translation key. */
export type TodoStatusLabel =
  | `tasks.sessionState.${TaskSessionState}`
  | `tasks.todo.mark.${TodoMark}`
  | `tasks.columns.${TaskStatus}`;

/**
 * What a row shows for where its task stands: the session its place names
 * (the strip's, or a mark's, which opens it) with its words, or a dot with
 * the mark's or the column's.
 */
export type TodoStatus =
  | { kind: 'session'; session: TaskSession; label: TodoStatusLabel }
  | { kind: 'dot'; state: StatusState; label: TodoStatusLabel };

export function todoStatusOf(task: TaskEntity, place: TodoPlace): TodoStatus {
  if (place.lane === 'agents') {
    return {
      kind: 'session',
      session: place.session,
      label: `tasks.sessionState.${place.session.state}`,
    };
  }
  if (place.mark) {
    const label = `tasks.todo.mark.${place.mark}` as const;
    return place.session
      ? { kind: 'session', session: place.session, label }
      : { kind: 'dot', state: MARK_DOT[place.mark], label };
  }
  return {
    kind: 'dot',
    state: TASK_STATUS_STATE[task.status],
    label: `tasks.columns.${task.status}`,
  };
}
