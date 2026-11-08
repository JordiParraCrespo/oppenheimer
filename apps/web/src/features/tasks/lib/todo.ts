import { compareRank, type TaskEntity } from '@oppenheimer/frontend-consumer';
import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * To do's address (the 2026-11-08 `Tasks` frame): the projects it is
 * narrowed to (as on the board), the day it lists (`YYYY-MM-DD`, today when
 * absent) and `overdue=off` to leave out what is overdue, which it includes
 * by default.
 */
export const todoSearchSchema = z.object({
  project: searchText,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  overdue: z.literal('off').optional().catch(undefined),
});
export type TodoSearch = z.infer<typeof todoSearchSchema>;

/** Where a task on the day's list stands, as its second line says it. */
export type TodoState = 'todo' | 'doing' | 'review' | 'done' | 'overdue';

export interface TodoEntry {
  task: TaskEntity;
  state: TodoState;
}

/**
 * The day's list: every task due that day, then — when `overdue` is on — the
 * open ones due before it, oldest first. Due that day, those with a time come
 * first in time order and the rest keep the board's order. `projectIds`
 * narrows it as the board's Project filter does (`undefined` is every project).
 */
export function todoEntries(
  tasks: readonly TaskEntity[],
  day: string,
  options: { overdue: boolean; projectIds?: readonly string[] },
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
  const overdue = options.overdue
    ? tasks
        .filter((task) => !task.isDone && task.dueDate && task.dueDate < day && inScope(task))
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || compareRank(a, b))
        .map((task) => ({ task, state: 'overdue' as const }))
    : [];
  return [...due, ...overdue];
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
