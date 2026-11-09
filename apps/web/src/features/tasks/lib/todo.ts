import { compareRank, type TaskEntity } from '@oppenheimer/frontend-consumer';
import { searchText } from '@oppenheimer/frontend-web';
import { calendarDateSchema } from '@oppenheimer/shared/schemas/task';
import { z } from 'zod';

/**
 * To do's address (the 2026-11-08 `Tasks` frame): the projects it is
 * narrowed to (as on the board), the day it lists (`YYYY-MM-DD`, today when
 * absent) and `overdue=off` to leave out what is overdue, which it includes
 * by default. `start` opens Start session for that task, as on the board.
 */
export const todoSearchSchema = z.object({
  project: searchText,
  date: calendarDateSchema.optional().catch(undefined),
  overdue: z.literal('off').optional().catch(undefined),
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

/**
 * What Add undated tasks offers: the open tasks with no due date, in the
 * projects To do is narrowed to (every project when `undefined`), in the
 * board's order.
 */
export function undatedTasks(
  tasks: readonly TaskEntity[],
  projectIds?: readonly string[],
): TaskEntity[] {
  return tasks
    .filter(
      (task) =>
        !task.isDone &&
        task.dueDate === null &&
        (!projectIds || projectIds.includes(task.projectId)),
    )
    .sort(compareRank);
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
