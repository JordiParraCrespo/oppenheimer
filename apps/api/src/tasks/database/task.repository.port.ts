import type { AccessScope } from '@oppenheimer/backend-authz';
import type { TaskStatus } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { TaskEntity, TaskSessionLink } from '../domain/task.entity';

/**
 * Where a task goes in a column: first, last, or directly after another task of
 * that column. The board may be filtered, so "after the card above where it was
 * dropped" is the one position a client can name.
 */
export interface TaskPlacement {
  status: TaskStatus;
  after: { kind: 'first' } | { kind: 'last' } | { kind: 'task'; taskId: string };
}

export interface TaskListFilter {
  projectId?: string;
  goalId?: string;
  /** The tasks a session is on: the session header's "Back to task". */
  sessionId?: string;
  dueFrom?: string;
  dueTo?: string;
}

/** `stale-position` when the task to land after is not in that column any more. */
export type TaskPlaceOutcome = 'placed' | 'stale-position';

/** `session-not-found` when the session is missing or in another workspace. */
export type TaskAttachOutcome = 'attached' | 'session-not-found';

/**
 * Reads take an {@link AccessScope}; writes take a task the caller already read
 * through one. A task's place in its column is the repository's to choose, in the
 * same transaction as the write, because it depends on its neighbours
 * (`product/versions/mvp/19-plan-tasks-and-goals.md` §2).
 */
export interface TaskRepositoryPort {
  /** Every task matching the filter, in board order (status, then rank), with its links. */
  findAll(scope: AccessScope, filter: TaskListFilter): Promise<TaskEntity[]>;
  /** `None` for a missing task and one outside the caller's scope alike. */
  findOneById(scope: AccessScope, id: string): Promise<Option<TaskEntity>>;
  /** Insert a new task at `placement`, setting its rank. */
  insert(task: TaskEntity, placement: TaskPlacement): Promise<TaskPlaceOutcome>;
  /** Write the fields a person edits: title, notes, due date and time, project and goal. */
  saveFields(task: TaskEntity): Promise<void>;
  /** Move the task to `placement`, setting its status and rank. */
  move(task: TaskEntity, placement: TaskPlacement): Promise<TaskPlaceOutcome>;
  delete(task: TaskEntity): Promise<void>;
  /**
   * Record a session on the task and apply the attach rule, in one transaction
   * under a lock on the task's row: the status is read there, so a drag that
   * committed after the click is what `seenStatus` is compared with.
   */
  attach(
    task: TaskEntity,
    link: TaskSessionLink,
    seenStatus: TaskStatus,
  ): Promise<TaskAttachOutcome>;
  /** Remove a session from the task. Removing one that is not there does nothing. */
  detach(task: TaskEntity, sessionId: string): Promise<void>;
}
