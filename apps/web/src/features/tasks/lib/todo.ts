import { compareRank, type TaskEntity } from '@oppenheimer/frontend-consumer';
import { searchText, todayIn } from '@oppenheimer/frontend-web';
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

/**
 * Why a task is on the day's list: it is planned for or due that day, it was
 * planned for an earlier day and is not done yet, or it is overdue.
 */
export type TodoReason = 'day' | 'carried' | 'overdue';

export interface TodoEntry {
  task: TaskEntity;
  reason: TodoReason;
}

type TodoOptions = { today: string; overdue: boolean; projectIds?: readonly string[] };

/** The day it was ticked done, in the reader's timezone. */
function doneOn(task: TaskEntity): string | null {
  return task.completedAt ? todayIn(task.completedAt.getTime()) : null;
}

/**
 * The day's list (`product/versions/mvp/20-plan-calendar.md` §6). To do is
 * what the reader means to work on, so first come the tasks put on that day
 * (their focus date) and those due on it, timed ones first in time order and
 * the rest in the board's order. Then, on today or a later day, what was put
 * on an earlier day and is not done yet, oldest first: it stays until it is
 * done, which is how work that takes days stays on the list. Then, when
 * `overdue` is on, what was due before today and is not done. A task carried
 * or overdue that is ticked done stays on the day it was done, so finishing
 * it does not make it vanish. A past day lists its own and what was finished
 * on it. `projectIds` narrows it as the board's Project filter does
 * (`undefined` is every project).
 */
export function todoEntries(
  tasks: readonly TaskEntity[],
  day: string,
  options: TodoOptions,
): TodoEntry[] {
  const inScope = (task: TaskEntity) =>
    !options.projectIds || options.projectIds.includes(task.projectId);
  const listed = new Set<string>();
  const take = (rows: TaskEntity[], reason: TodoReason): TodoEntry[] =>
    rows.flatMap((task) => {
      if (listed.has(task.id) || !inScope(task)) return [];
      listed.add(task.id);
      return [{ task, reason }];
    });
  const ahead = day >= options.today;
  // Still open and from before today, or finished on this very day.
  const stillHere = (from: string | null) => (task: TaskEntity) =>
    from !== null &&
    (task.isDone ? from < day && doneOn(task) === day : ahead && from < options.today);

  const own = take(
    tasks
      .filter((task) => task.dueDate === day || task.focusDate === day)
      .sort((a, b) => {
        const at = a.dueDate === day ? a.dueTime : null;
        const bt = b.dueDate === day ? b.dueTime : null;
        if (at && bt) return at.localeCompare(bt);
        if (at || bt) return at ? -1 : 1;
        return compareRank(a, b);
      }),
    'day',
  );
  const carried = take(
    tasks
      .filter((task) => stillHere(task.focusDate)(task))
      .sort((a, b) => (a.focusDate ?? '').localeCompare(b.focusDate ?? '') || compareRank(a, b)),
    'carried',
  );
  const overdue = options.overdue
    ? take(
        tasks
          .filter((task) => stillHere(task.dueDate)(task))
          .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || compareRank(a, b)),
        'overdue',
      )
    : [];
  return [...own, ...carried, ...overdue];
}

/**
 * The day as To do draws it: the entries the project filter keeps, and
 * whether the day held any before it narrowed (so an empty list can say
 * "no match" rather than "nothing yet").
 */
export function todoDay(
  tasks: readonly TaskEntity[],
  day: string,
  options: TodoOptions,
): { entries: TodoEntry[]; dayHasAny: boolean } {
  const entries = todoEntries(tasks, day, options);
  const dayHasAny = options.projectIds
    ? entries.length > 0 ||
      todoEntries(tasks, day, { ...options, projectIds: undefined }).length > 0
    : entries.length > 0;
  return { entries, dayHasAny };
}

/** One part of a row's second line, as a translation key and the day it names. */
export type TodoLabel =
  | {
      key: 'tasks.todo.state.overdue' | 'tasks.todo.state.since' | 'tasks.todo.state.dueOn';
      date: string;
    }
  | { key: 'tasks.todo.state.todo' | 'tasks.todo.state.due' };

/**
 * A row's second line, beside its milestone: since when it has been on To do
 * when it was carried over, then when it is due: overdue since its day, "due
 * today" on today ("due" on another day it is due), or the day it is due.
 * A task with no due date that is planned for the day says nothing more.
 * Where the task stands is the row's status dot, not this line.
 */
export function todoLabels(entry: TodoEntry, day: string, today: string): TodoLabel[] {
  const { task } = entry;
  const labels: TodoLabel[] = [];
  if (entry.reason === 'carried' && task.focusDate)
    labels.push({ key: 'tasks.todo.state.since', date: task.focusDate });
  if (task.isOverdue(today) && task.dueDate)
    labels.push({ key: 'tasks.todo.state.overdue', date: task.dueDate });
  else if (task.dueDate === day)
    labels.push({ key: day === today ? 'tasks.todo.state.todo' : 'tasks.todo.state.due' });
  else if (task.dueDate) labels.push({ key: 'tasks.todo.state.dueOn', date: task.dueDate });
  return labels;
}

/**
 * What Add tasks offers for a day: the open tasks not already on its list,
 * in the projects To do is narrowed to (every project when `undefined`), in
 * the board's order. Adding one puts it on that day; its due date stays.
 */
export function addableTasks(
  tasks: readonly TaskEntity[],
  onDay: ReadonlySet<string>,
  projectIds?: readonly string[],
): TaskEntity[] {
  return tasks
    .filter(
      (task) =>
        !task.isDone && !onDay.has(task.id) && (!projectIds || projectIds.includes(task.projectId)),
    )
    .sort(compareRank);
}

/** The header's count: how many on the list are left and how many are done. */
export function todoCounts(entries: readonly TodoEntry[]): { left: number; done: number } {
  const done = entries.filter((entry) => entry.task.isDone).length;
  return { left: entries.length - done, done };
}

/** The sidebar's count beside To do: what is left on today's list. */
export function todayOpenCount(tasks: readonly TaskEntity[], today: string): number {
  return todoEntries(tasks, today, { today, overdue: true }).filter((entry) => !entry.task.isDone)
    .length;
}
