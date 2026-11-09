import { compareRank, type MilestoneEntity, type TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';

/**
 * What the board is narrowed to: a set of projects (their ids; absent is All
 * projects, empty is none) and a milestone, either or neither.
 */
export interface BoardFilter {
  projectIds?: readonly string[];
  milestoneId?: string;
}

/** The one project the board is narrowed to, when it is narrowed to exactly one. */
export function soleProjectOf(filter: BoardFilter): string | undefined {
  return filter.projectIds?.length === 1 ? filter.projectIds[0] : undefined;
}

/**
 * Where a task added from the board is filed: a milestone brings its own project
 * (the API refuses a project that disagrees with it), else the first project the
 * board is filtered to (so the task stays in view), else the workspace's
 * Unassigned one. A filtered milestone the list does not
 * have (deleted, or not refetched yet) is sent without a project, so the API
 * files under its project or says it is gone, rather than the task quietly
 * landing elsewhere.
 */
export function filingOf(
  filter: BoardFilter,
  milestones: readonly Pick<MilestoneEntity, 'id' | 'projectId'>[],
  unassignedId: string | undefined,
): { projectId: string | undefined; milestoneId: string | null } {
  const milestone = filter.milestoneId
    ? milestones.find((row) => row.id === filter.milestoneId)
    : undefined;
  return {
    projectId: filter.milestoneId ? milestone?.projectId : filter.projectIds?.[0] || unassignedId,
    milestoneId: filter.milestoneId ?? null,
  };
}

function passes(task: TaskEntity, filter: BoardFilter): boolean {
  return (
    (!filter.projectIds || filter.projectIds.includes(task.projectId)) &&
    (!filter.milestoneId || task.milestoneId === filter.milestoneId)
  );
}

/** One column's cards, in board order. */
export function columnOf(tasks: readonly TaskEntity[], status: TaskStatus, filter: BoardFilter) {
  return tasks.filter((task) => task.status === status && passes(task, filter)).sort(compareRank);
}

/**
 * How many days a finished task stays in Done before the column folds it
 * under "Show older" (`18-plan-product.md` §2): Linear's "past week".
 */
const DONE_RECENT_DAYS = 7;

/**
 * The moment before which a task finished is older: local midnight
 * `DONE_RECENT_DAYS` days before `today`, so a card folds away at the turn of
 * a day, not at the minute it was ticked a week ago.
 */
export function doneCutoffOf(today: string): Date {
  const [year, month, day] = today.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) - DONE_RECENT_DAYS);
}

/**
 * Done's cards, split by when they were finished: those since `cutoff`, and
 * the older ones the column folds away. A done task with no `completedAt`
 * counts as recent, so nothing is hidden for want of a date. Each half keeps
 * the column's order.
 */
export function splitDone(column: readonly TaskEntity[], cutoff: Date) {
  const recent: TaskEntity[] = [];
  const older: TaskEntity[] = [];
  for (const task of column) {
    (task.completedAt && task.completedAt < cutoff ? older : recent).push(task);
  }
  return { recent, older };
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
