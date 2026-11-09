import { compareRank, type TaskEntity } from '@oppenheimer/frontend-consumer';
import { searchText } from '@oppenheimer/frontend-web';
import { calendarDateSchema } from '@oppenheimer/shared/schemas/task';
import { z } from 'zod';

/**
 * To do's address (the 2026-11-08 `Tasks` frame): the projects it is
 * narrowed to (as on the board), the day it lists (`YYYY-MM-DD`, today when
 * absent) and `overdue=off` to leave out what is overdue, which it includes
 * by default. `task` opens that task's dialog and `start` Start session for
 * it, as on the board.
 */
export const todoSearchSchema = z.object({
  project: searchText,
  date: calendarDateSchema.optional().catch(undefined),
  overdue: z.literal('off').optional().catch(undefined),
  task: searchText,
  start: searchText,
});
export type TodoSearch = z.infer<typeof todoSearchSchema>;

/** Where a task on the day's list stands, as its second line says it. */
export type TodoState = 'todo' | 'doing' | 'review' | 'done' | 'overdue';

export interface TodoEntry {
  task: TaskEntity;
  state: TodoState;
}

/**
 * The day's list: every task due that day, then — when `overdue` is on and
 * the day is today or later — the open ones due before today, oldest first.
 * A task due between today and a later day shown is not overdue, and a past
 * day lists only its own. Due that day, those with a time come first in time
 * order and the rest keep the board's order. `projectIds` narrows it as the
 * board's Project filter does (`undefined` is every project).
 */
export function todoEntries(
  tasks: readonly TaskEntity[],
  day: string,
  options: { today: string; overdue: boolean; projectIds?: readonly string[] },
): TodoEntry[] {
  const inScope = (task: TaskEntity) =>
    !options.projectIds || options.projectIds.includes(task.projectId);
  const due = tasks
    .filter((task) => task.dueDate === day && inScope(task))
    .sort((a, b) => {
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      if (a.dueTime || b.dueTime) return a.dueTime ? -1 : 1;
      return compareRank(a, b);
    })
    .map((task) => ({ task, state: task.status }));
  const overdue =
    options.overdue && day >= options.today
      ? tasks
          .filter(
            (task) => !task.isDone && task.dueDate && task.dueDate < options.today && inScope(task),
          )
          .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || compareRank(a, b))
          .map((task) => ({ task, state: 'overdue' as const }))
      : [];
  return [...due, ...overdue];
}

/**
 * The day as To do draws it: the entries the project filter keeps, and
 * whether the day held any before it narrowed (so an empty list can say
 * "no match" rather than "nothing yet").
 */
export function todoDay(
  tasks: readonly TaskEntity[],
  day: string,
  options: { today: string; overdue: boolean; projectIds?: readonly string[] },
): { entries: TodoEntry[]; dayHasAny: boolean } {
  const entries = todoEntries(tasks, day, options);
  const dayHasAny = options.projectIds
    ? entries.length > 0 ||
      todoEntries(tasks, day, { ...options, projectIds: undefined }).length > 0
    : entries.length > 0;
  return { entries, dayHasAny };
}

/**
 * The second line's "when it is due", as a translation key: overdue since
 * its day, "due today" only on today ("due" on another day). Where the task
 * stands is the row's status dot, not this line.
 */
export function todoStateLabel(
  entry: TodoEntry,
  day: string,
  today: string,
):
  | { key: 'tasks.todo.state.overdue'; date: string }
  | { key: 'tasks.todo.state.todo' | 'tasks.todo.state.due' } {
  if (entry.state === 'overdue')
    return { key: 'tasks.todo.state.overdue', date: entry.task.dueDate ?? day };
  return { key: day === today ? 'tasks.todo.state.todo' : 'tasks.todo.state.due' };
}

/** The columns Add undated tasks offers from: every open one. */
export const OPEN_STATUSES = [
  'todo',
  'doing',
  'review',
] as const satisfies readonly TaskEntity['status'][];
export type OpenStatus = (typeof OPEN_STATUSES)[number];

/** Whether a facet's value is one of `OPEN_STATUSES`, so a string pick reads back typed. */
export function isOpenStatus(value: string): value is OpenStatus {
  return (OPEN_STATUSES as readonly string[]).includes(value);
}

/** What Add undated tasks' own filters narrow it to; empty is every one. */
export interface UndatedFilter {
  projectIds: readonly string[];
  statuses: readonly OpenStatus[];
}

export const NO_UNDATED_FILTER: UndatedFilter = { projectIds: [], statuses: [] };

/**
 * What Add undated tasks offers: the open tasks with no due date, in the
 * projects and columns the filter picks (every one when unset), in the
 * board's order.
 */
export function undatedTasks(
  tasks: readonly TaskEntity[],
  filter: UndatedFilter = NO_UNDATED_FILTER,
): TaskEntity[] {
  return tasks
    .filter(
      (task) =>
        !task.isDone &&
        task.dueDate === null &&
        inProjects(task, filter) &&
        inStatuses(task, filter),
    )
    .sort(compareRank);
}

const inProjects = (task: TaskEntity, filter: UndatedFilter) =>
  !filter.projectIds.length || filter.projectIds.includes(task.projectId);
const inStatuses = (task: TaskEntity, filter: UndatedFilter) =>
  !filter.statuses.length || (filter.statuses as readonly string[]).includes(task.status);

/**
 * Add undated tasks' facet counts: each undated task counts toward its
 * project when the picked columns keep it, and toward its column when the
 * picked projects keep it, so a facet's own pick never zeroes its options.
 */
export function undatedCounts(
  tasks: readonly TaskEntity[],
  filter: UndatedFilter,
): { byProject: Record<string, number>; byStatus: Record<string, number> } {
  const byProject: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const task of undatedTasks(tasks)) {
    if (inStatuses(task, filter)) byProject[task.projectId] = (byProject[task.projectId] ?? 0) + 1;
    if (inProjects(task, filter)) byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
  }
  return { byProject, byStatus };
}

/** The picks Add schedules: those the filtered list still shows, so a hidden pick waits. */
export function picksInView(picked: readonly string[], shown: readonly TaskEntity[]): string[] {
  const ids = new Set(shown.map((task) => task.id));
  return picked.filter((id) => ids.has(id));
}

/** The header's count: how many on the list are left and how many are done. */
export function todoCounts(entries: readonly TodoEntry[]): { left: number; done: number } {
  const done = entries.filter((entry) => entry.task.isDone).length;
  return { left: entries.length - done, done };
}

/** The sidebar's count beside To do: open tasks due today or before it. */
export function todayOpenCount(tasks: readonly TaskEntity[], today: string): number {
  return tasks.filter((task) => !task.isDone && task.dueDate !== null && task.dueDate <= today)
    .length;
}
