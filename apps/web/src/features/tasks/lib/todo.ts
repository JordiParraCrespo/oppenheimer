import { compareRank, type SessionEntity, type TaskEntity } from '@oppenheimer/frontend-consumer';
import { searchText, todayIn } from '@oppenheimer/frontend-web';
import { calendarDateSchema } from '@oppenheimer/shared/schemas/task';
import { z } from 'zod';
import { type TaskSession, taskSessionsOf } from './session-line';
import { mostUrgent, type TaskSessionState } from './session-state';

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

export type TodoOptions = { today: string; overdue: boolean; projectIds?: readonly string[] };

/** The day it was ticked done, in the reader's timezone. */
function doneOn(task: TaskEntity): string | null {
  return task.completedAt ? todayIn(task.completedAt.getTime()) : null;
}

/**
 * A task put on an earlier day than `day` that comes along to it: still open,
 * shown on today or a later day (today's comes along to tomorrow), or ticked
 * done on `day` itself, so finishing it does not make it vanish.
 */
function isCarriedTo(task: TaskEntity, day: string, today: string): boolean {
  if (!task.focusDate || task.focusDate >= day) return false;
  return task.isDone ? doneOn(task) === day : day >= today;
}

/**
 * A task due before today that is on `day` as overdue: still open, shown on
 * today or a later day, or ticked done on `day` itself. A due date turns
 * overdue only once today has passed it, whatever day is shown.
 */
function isOverdueOn(task: TaskEntity, day: string, today: string): boolean {
  if (!task.dueDate) return false;
  return task.isDone
    ? task.dueDate < day && doneOn(task) === day
    : day >= today && task.dueDate < today;
}

/**
 * The day's list (`product/versions/mvp/20-plan-calendar.md` §6). To do is
 * what the reader means to work on, so first come the tasks put on that day
 * (their focus date) and those due on it, timed ones first in time order and
 * the rest in the board's order. Then, on today or a later day, what was put
 * on an earlier day than the one shown and is not done yet, oldest first: it
 * stays until it is done, which is how work that takes days stays on the
 * list, and today's comes along when tomorrow is planned. Then, when
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
      .filter((task) => isCarriedTo(task, day, options.today))
      .sort((a, b) => (a.focusDate ?? '').localeCompare(b.focusDate ?? '') || compareRank(a, b)),
    'carried',
  );
  const overdue = options.overdue
    ? take(
        tasks
          .filter((task) => isOverdueOn(task, day, options.today))
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
  // Due on the day shown is that day's own, even on a past day it is now overdue for.
  if (task.dueDate === day)
    labels.push({ key: day === today ? 'tasks.todo.state.todo' : 'tasks.todo.state.due' });
  else if (task.isOverdue(today) && task.dueDate)
    labels.push({ key: 'tasks.todo.state.overdue', date: task.dueDate });
  else if (task.dueDate) labels.push({ key: 'tasks.todo.state.dueOn', date: task.dueDate });
  return labels;
}

/** The columns Add tasks offers from: every open one. */
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

/** What Add tasks' own filters narrow it to; empty is every one. */
export interface AddFilter {
  projectIds: readonly string[];
  statuses: readonly OpenStatus[];
}

export const NO_ADD_FILTER: AddFilter = { projectIds: [], statuses: [] };

/**
 * What Add tasks offers for a day: the open tasks not already on its list,
 * in the projects and columns the filter picks (every one when unset), in
 * the board's order. Adding one puts it on that day; its due date stays.
 */
export function addableTasks(
  tasks: readonly TaskEntity[],
  onDay: ReadonlySet<string>,
  filter: AddFilter = NO_ADD_FILTER,
): TaskEntity[] {
  return tasks
    .filter(
      (task) =>
        !task.isDone && !onDay.has(task.id) && inProjects(task, filter) && inStatuses(task, filter),
    )
    .sort(compareRank);
}

const inProjects = (task: TaskEntity, filter: AddFilter) =>
  !filter.projectIds.length || filter.projectIds.includes(task.projectId);
const inStatuses = (task: TaskEntity, filter: AddFilter) =>
  !filter.statuses.length || (filter.statuses as readonly string[]).includes(task.status);

/**
 * Add tasks' facet counts: each task it could offer counts toward its
 * project when the picked columns keep it, and toward its column when the
 * picked projects keep it, so a facet's own pick never zeroes its options.
 */
export function addableCounts(
  tasks: readonly TaskEntity[],
  onDay: ReadonlySet<string>,
  filter: AddFilter,
): { byProject: Record<string, number>; byStatus: Record<string, number> } {
  const byProject: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const task of addableTasks(tasks, onDay)) {
    if (inStatuses(task, filter)) byProject[task.projectId] = (byProject[task.projectId] ?? 0) + 1;
    if (inProjects(task, filter)) byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
  }
  return { byProject, byStatus };
}

/** The picks Add puts on the day: those the filtered list still shows, so a hidden pick waits. */
export function picksInView(picked: readonly string[], shown: readonly TaskEntity[]): string[] {
  const ids = new Set(shown.map((task) => task.id));
  return picked.filter((id) => ids.has(id));
}

/**
 * Whether a task on the day's list is there because of its deadline: due on
 * the day shown, or overdue while Include overdue is on. Moving its TODO day
 * does not take it off, so the row offers no Move (§6, "Changed on 2026-11-12").
 */
export function heldByDeadline(task: TaskEntity, day: string, options: TodoOptions): boolean {
  if (task.isDone || !task.dueDate) return false;
  return task.dueDate === day || (options.overdue && isOverdueOn(task, day, options.today));
}

/** Why a task on the main list carries a mark from its agents, or its column. */
export type TodoMark = 'waiting' | 'failed' | 'review' | 'stopped';

/**
 * Where a task on the day's list goes: the main list, with the mark that says
 * why it needs the person, or the "With agents" strip, with the session at
 * work. `session` is the one the mark or the strip names.
 */
export type TodoPlace =
  | { lane: 'list'; mark: TodoMark | null; session: TaskSession | null }
  | { lane: 'agents'; session: TaskSession };

const LIST_UNMARKED: TodoPlace = { lane: 'list', mark: null, session: null };

/**
 * Where a task goes on To do, from its sessions' states, most urgent first
 * (`product/versions/mvp/20-plan-calendar.md` §6, "Changed on 2026-11-12"): one waiting
 * on the person keeps it on the list as "waiting on you"; otherwise one
 * running or queued puts it in the strip, whatever its due date; otherwise a
 * failed one marks it "failed"; otherwise the board's In review column marks
 * it "ready to review"; otherwise sessions that stopped (idle or finished)
 * on a task still In progress mark it "agent stopped". A session ending
 * never means the task is finished: ready to review comes from the column
 * alone. A done task, or one with no sessions, is on the list unmarked.
 */
export function todoPlaceOf(task: TaskEntity, sessions: readonly TaskSession[]): TodoPlace {
  if (task.isDone) return LIST_UNMARKED;
  const first = (...states: TaskSessionState[]) =>
    mostUrgent(sessions.filter((row) => states.includes(row.state)));
  const waiting = first('waiting');
  if (waiting) return { lane: 'list', mark: 'waiting', session: waiting };
  const working = first('queued', 'running');
  if (working) return { lane: 'agents', session: working };
  const failed = first('failed');
  if (failed) return { lane: 'list', mark: 'failed', session: failed };
  if (task.status === 'review') return { lane: 'list', mark: 'review', session: null };
  const stopped = first('idle', 'completed');
  if (stopped && task.status === 'doing')
    return { lane: 'list', mark: 'stopped', session: stopped };
  return LIST_UNMARKED;
}

/**
 * The tasks an agent is working on, which To do draws in its strip and leaves
 * out of its counts. Whether a host is online only tells queued from running,
 * which go to the strip alike, so the hosts are not read.
 */
function withAgentsOf(
  tasks: readonly TaskEntity[],
  sessions: ReadonlyMap<string, SessionEntity>,
): ReadonlySet<string> {
  return new Set(
    tasks
      .filter((task) => todoPlaceOf(task, taskSessionsOf(task, sessions)).lane === 'agents')
      .map((task) => task.id),
  );
}

/**
 * The header's count: how many on the day's list are left and how many are
 * done. What is with agents needs nothing from the person, so it is not left;
 * until the sessions are read there is no count, so one never lands and then
 * drops.
 */
export function todoCounts(
  tasks: readonly TaskEntity[],
  day: string,
  options: TodoOptions,
  sessions: ReadonlyMap<string, SessionEntity> | undefined,
): { left: number; done: number } | undefined {
  if (!sessions) return undefined;
  const entries = todoEntries(tasks, day, options);
  const withAgents = withAgentsOf(tasks, sessions);
  const done = entries.filter((entry) => entry.task.isDone).length;
  const working = entries.filter((entry) => withAgents.has(entry.task.id)).length;
  return { left: entries.length - done - working, done };
}
