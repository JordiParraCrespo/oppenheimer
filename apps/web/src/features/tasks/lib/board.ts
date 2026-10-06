import { compareRank, type TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';

/** The board's columns, in the frames' order (`Tasks.dc.html`). */
export const COLUMNS: readonly TaskStatus[] = ['later', 'todo', 'doing', 'done'];

/** What the board is narrowed to: a project (its id) and a goal, either or neither. */
export interface BoardFilter {
  projectId?: string;
  goalId?: string;
}

function passes(task: TaskEntity, filter: BoardFilter): boolean {
  return (
    (!filter.projectId || task.projectId === filter.projectId) &&
    (!filter.goalId || task.goalId === filter.goalId)
  );
}

/** One column's cards, in board order. */
export function columnOf(tasks: readonly TaskEntity[], status: TaskStatus, filter: BoardFilter) {
  return tasks.filter((task) => task.status === status && passes(task, filter)).sort(compareRank);
}

/** The header's counts: open, in progress, done and overdue, on what the filter shows. */
export function boardCounts(tasks: readonly TaskEntity[], filter: BoardFilter, today: string) {
  const shown = tasks.filter((task) => passes(task, filter));
  return {
    open: shown.filter((task) => !task.isDone).length,
    doing: shown.filter((task) => task.status === 'doing').length,
    done: shown.filter((task) => task.isDone).length,
    overdue: shown.filter((task) => task.isOverdue(today)).length,
  };
}

/**
 * Where a card dropped at `index` of a column lands: after the card above it, or
 * first. The moved card is not one of `column`'s rows.
 */
export function afterTaskIdFor(column: readonly TaskEntity[], index: number): string | null {
  return index > 0 ? (column[index - 1]?.id ?? null) : null;
}
