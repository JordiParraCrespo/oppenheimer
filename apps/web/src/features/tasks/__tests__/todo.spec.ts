import { SessionEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { describe, expect, it } from 'vitest';
import { taskSessionsOf } from '../lib/session-line';
import {
  type AddFilter,
  addableCounts,
  addableTasks,
  heldByDeadline,
  picksInView,
  todayOpenCount,
  todoCounts,
  todoDay,
  todoEntries,
  todoLabels,
  todoPlaceOf,
  todoSearchSchema,
  withAgentsOf,
} from '../lib/todo';

function task(
  id: string,
  overrides: Partial<{
    status: TaskStatus;
    projectId: string;
    dueDate: string | null;
    dueTime: string | null;
    focusDate: string | null;
    completedAt: string;
    sessionIds: string[];
  }> = {},
) {
  return new TaskEntity(
    id,
    overrides.projectId ?? 'p-1',
    null,
    overrides.status ?? 'todo',
    id,
    `Task ${id}`,
    '',
    overrides.dueDate ?? null,
    overrides.dueTime ?? null,
    overrides.status === 'done' ? new Date(overrides.completedAt ?? '2026-11-01T12:00:00') : null,
    (overrides.sessionIds ?? []).map((sessionId) => ({
      sessionId,
      origin: 'started' as const,
      linkedAt: new Date('2026-11-01T00:00:00Z'),
    })),
    new Date('2026-11-01T00:00:00Z'),
    new Date('2026-11-01T00:00:00Z'),
    null,
    1,
    overrides.focusDate ?? null,
  );
}

const DAY = '2026-11-08';
const TASKS = [
  task('c', { dueDate: DAY }),
  task('b', { dueDate: DAY, dueTime: '14:00' }),
  task('a', { dueDate: DAY, dueTime: '09:30', status: 'done' }),
  task('old', { dueDate: '2026-11-02' }),
  task('older', { dueDate: '2026-10-30', projectId: 'p-2' }),
  task('closed', { dueDate: '2026-11-01', status: 'done' }),
  task('later', { dueDate: '2026-11-09' }),
  task('undated'),
];

describe("To do's day", () => {
  const ids = (rows: { task: { id: string }; reason: string }[]) =>
    rows.map((row) => [row.task.id, row.reason]);

  it('lists the day by time, then the rest in board order, then what is overdue, oldest first', () => {
    const rows = todoEntries(TASKS, DAY, { today: DAY, overdue: true });
    expect(ids(rows)).toEqual([
      ['a', 'day'],
      ['b', 'day'],
      ['c', 'day'],
      ['older', 'overdue'],
      ['old', 'overdue'],
    ]);
  });

  it('leaves out overdue work when it is off, and a done task is never overdue', () => {
    expect(
      todoEntries(TASKS, DAY, { today: DAY, overdue: false }).map((row) => row.task.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('narrows to the projects the filter names', () => {
    const rows = todoEntries(TASKS, DAY, { today: DAY, overdue: true, projectIds: ['p-2'] });
    expect(rows.map((row) => row.task.id)).toEqual(['older']);
  });

  it('marks only what was due before today overdue, on a later day, and none on a past one', () => {
    // A task due tomorrow is not overdue on the day after it is shown; it is that day's own.
    const ahead = todoEntries(TASKS, '2026-11-10', { today: DAY, overdue: true });
    expect(ids(ahead)).toEqual([
      ['older', 'overdue'],
      ['old', 'overdue'],
    ]);
    expect(
      todoEntries(TASKS, '2026-11-02', { today: DAY, overdue: true }).map((row) => row.task.id),
    ).toEqual(['old']);
  });

  it('lists a task put on the day whatever its due date, and keeps it on later days until it is done', () => {
    const rows = [
      task('focus', { focusDate: DAY, dueDate: '2026-11-20' }),
      task('carried', { focusDate: '2026-11-05' }),
      task('carried-due', { focusDate: '2026-11-06', dueDate: '2026-11-04' }),
      task('finished', {
        focusDate: '2026-11-05',
        status: 'done',
        completedAt: '2026-11-06T10:00:00',
      }),
      task('tomorrow', { focusDate: '2026-11-09' }),
    ];
    // Work from an earlier day stays, oldest first, ahead of what is overdue, and a task listed for
    // one reason is not listed again for another.
    expect(ids(todoEntries(rows, DAY, { today: DAY, overdue: true }))).toEqual([
      ['focus', 'day'],
      ['carried', 'carried'],
      ['carried-due', 'carried'],
    ]);
    // Planned for tomorrow, it is tomorrow's; looking ahead, today's leftovers come along.
    expect(ids(todoEntries(rows, '2026-11-09', { today: DAY, overdue: false }))).toEqual([
      ['tomorrow', 'day'],
      ['carried', 'carried'],
      ['carried-due', 'carried'],
      ['focus', 'carried'],
    ]);
    // Two days on, tomorrow's comes along too, after the older ones.
    expect(
      todoEntries(rows, '2026-11-10', { today: DAY, overdue: false }).map((row) => row.task.id),
    ).toEqual(['carried', 'carried-due', 'focus', 'tomorrow']);
    // A past day keeps its own and what was finished on it; nothing open is carried back.
    expect(ids(todoEntries(rows, '2026-11-06', { today: DAY, overdue: true }))).toEqual([
      ['carried-due', 'day'],
      ['finished', 'carried'],
    ]);
  });

  it('keeps a carried or overdue task on the day it is ticked done, and only that day', () => {
    const rows = [
      task('carried', {
        focusDate: '2026-11-05',
        status: 'done',
        completedAt: '2026-11-08T09:00:00',
      }),
      task('late', { dueDate: '2026-11-02', status: 'done', completedAt: '2026-11-08T17:00:00' }),
    ];
    expect(ids(todoEntries(rows, DAY, { today: DAY, overdue: true }))).toEqual([
      ['carried', 'carried'],
      ['late', 'overdue'],
    ]);
    expect(todoEntries(rows, '2026-11-09', { today: '2026-11-09', overdue: true })).toEqual([]);
  });

  it('counts what is left and done, and the sidebar counts what is left on today', () => {
    const none = new Set<string>();
    expect(todoCounts(todoEntries(TASKS, DAY, { today: DAY, overdue: true }), none)).toEqual({
      left: 4,
      done: 1,
    });
    expect(todayOpenCount(TASKS, DAY, none)).toBe(4);
    expect(todayOpenCount([...TASKS, task('planned', { focusDate: DAY })], DAY, none)).toBe(5);
  });

  it('drops a day that is not on the calendar from the address', () => {
    expect(todoSearchSchema.parse({ date: '2026-99-99' }).date).toBeUndefined();
  });

  it('tells a narrowed empty day from an empty one', () => {
    const narrowed = todoDay(TASKS, DAY, { today: DAY, overdue: false, projectIds: ['p-9'] });
    expect(narrowed).toEqual({ entries: [], dayHasAny: true });
    expect(todoDay(TASKS, '2026-12-01', { today: DAY, overdue: false }).dayHasAny).toBe(false);
  });

  it('says since when a task was carried, then when it is due', () => {
    const [, open] = todoEntries(TASKS, DAY, { today: DAY, overdue: false });
    expect(todoLabels(open, DAY, DAY)).toEqual([{ key: 'tasks.todo.state.todo' }]);
    expect(todoLabels(open, DAY, '2026-11-07')).toEqual([{ key: 'tasks.todo.state.due' }]);
    const overdue = { task: TASKS[3], reason: 'overdue' as const };
    expect(todoLabels(overdue, DAY, DAY)).toEqual([
      { key: 'tasks.todo.state.overdue', date: '2026-11-02' },
    ]);
    const carried = {
      task: task('x', { focusDate: '2026-11-05', dueDate: '2026-11-12' }),
      reason: 'carried' as const,
    };
    expect(todoLabels(carried, DAY, DAY)).toEqual([
      { key: 'tasks.todo.state.since', date: '2026-11-05' },
      { key: 'tasks.todo.state.dueOn', date: '2026-11-12' },
    ]);
    // On a past day, a task due that day reads as due, not as overdue since that day.
    const [pastDue] = todoEntries(TASKS, '2026-11-02', { today: DAY, overdue: true });
    expect(todoLabels(pastDue, '2026-11-02', DAY)).toEqual([{ key: 'tasks.todo.state.due' }]);
    // Planned for the day with no due date: nothing more to say.
    expect(todoLabels({ task: task('y', { focusDate: DAY }), reason: 'day' }, DAY, DAY)).toEqual(
      [],
    );
  });

  it('offers the open tasks not already on the day, dated or not, in the projects in scope', () => {
    const rows = [
      task('a'),
      task('b', { status: 'done' }),
      task('c', { dueDate: DAY }),
      task('d', { projectId: 'p-2', status: 'doing', dueDate: '2026-11-30' }),
    ];
    expect(addableTasks(rows, new Set(['c'])).map((row) => row.id)).toEqual(['a', 'd']);
    expect(
      addableTasks(rows, new Set(), { projectIds: ['p-2'], statuses: [] }).map((row) => row.id),
    ).toEqual(['d']);
  });

  it('narrows to the projects and columns picked, both at once', () => {
    const rows = [
      task('a'),
      task('d', { projectId: 'p-2', status: 'doing' }),
      task('e', { projectId: 'p-2', status: 'review' }),
    ];
    const ids = (filter?: Partial<AddFilter>) =>
      addableTasks(rows, new Set(), { projectIds: [], statuses: [], ...filter }).map(
        (row) => row.id,
      );
    expect(ids()).toEqual(['a', 'd', 'e']);
    expect(ids({ projectIds: ['p-2'] })).toEqual(['d', 'e']);
    expect(ids({ statuses: ['todo', 'review'] })).toEqual(['a', 'e']);
    expect(ids({ projectIds: ['p-2'], statuses: ['doing'] })).toEqual(['d']);
  });

  it('counts each facet under the other one, so a pick never zeroes its own options', () => {
    const rows = [
      task('a'),
      task('d', { projectId: 'p-2', status: 'doing' }),
      task('e', { projectId: 'p-2', status: 'review' }),
    ];
    expect(
      addableCounts(rows, new Set(['a']), { projectIds: ['p-2'], statuses: ['doing'] }),
    ).toEqual({
      byProject: { 'p-2': 1 },
      byStatus: { doing: 1, review: 1 },
    });
  });

  it('adds only the picks the filtered list still shows', () => {
    expect(picksInView(['a', 'd', 'x'], [task('d'), task('a')])).toEqual(['a', 'd']);
  });
});

function session(
  id: string,
  lifecycle: SessionEntity['lifecycle'],
  state: SessionEntity['state'] = 'working',
) {
  return new SessionEntity({
    id,
    organizationId: 'org-1',
    projectId: 'p-1',
    hostId: 'h-1',
    name: `Session ${id}`,
    slug: id,
    agent: 'claude-code',
    launch: { model: null, permission: null, effort: null },
    state,
    lifecycle,
    cwdCheckoutId: null,
    checkouts: [],
    stoppedAt: null,
    hints: [],
    createdAt: new Date('2026-10-01T00:00:00Z'),
    place: 'worktree',
    folderPath: null,
  });
}

const SESSIONS = new Map(
  [
    session('running', 'open', 'working'),
    session('starting', 'starting'),
    session('waiting', 'open', 'waiting-on-you'),
    session('failed', 'failed'),
    session('idle', 'open', 'idle'),
    session('ended', 'resolved', 'idle'),
  ].map((row) => [row.id, row]),
);
const HOSTS = new Map();

/**
 * TODO's "With agents" strip (`20-plan-calendar.md` §6, "Changed on 2026-11-12"): a task an agent is
 * working on leaves the list; one whose agents need the person stays on it
 * with a mark, most urgent first.
 */
describe("TODO's agents", () => {
  const placeOf = (row: TaskEntity) => {
    const place = todoPlaceOf(row, taskSessionsOf(row, SESSIONS, HOSTS));
    return place.lane === 'agents' ? `agents:${place.session.state}` : place.mark;
  };

  it('puts a task with a session running or queued in the strip, due today or not', () => {
    expect(placeOf(task('t', { status: 'doing', dueDate: DAY, sessionIds: ['running'] }))).toBe(
      'agents:running',
    );
    expect(placeOf(task('t', { status: 'doing', sessionIds: ['starting', 'idle'] }))).toBe(
      'agents:running',
    );
  });

  it('keeps one waiting on the person on the list, over another session still running', () => {
    expect(placeOf(task('t', { status: 'doing', sessionIds: ['running', 'waiting'] }))).toBe(
      'waiting',
    );
  });

  it('marks a failed session, then In review, then stopped sessions on a task still in progress', () => {
    expect(placeOf(task('t', { status: 'review', sessionIds: ['failed', 'idle'] }))).toBe('failed');
    expect(placeOf(task('t', { status: 'review', sessionIds: ['ended'] }))).toBe('review');
    expect(placeOf(task('t', { status: 'doing', sessionIds: ['ended'] }))).toBe('stopped');
    expect(placeOf(task('t', { status: 'doing', sessionIds: ['idle'] }))).toBe('stopped');
  });

  it('never reads a finished session as ready to review: the column alone says it', () => {
    expect(placeOf(task('t', { status: 'todo', sessionIds: ['ended'] }))).toBeNull();
  });

  it('leaves a task with no sessions, or a done one, unmarked', () => {
    expect(placeOf(task('t', { status: 'doing' }))).toBeNull();
    expect(placeOf(task('t', { status: 'done', sessionIds: ['waiting'] }))).toBeNull();
    expect(placeOf(task('t', { status: 'doing', sessionIds: ['deleted'] }))).toBeNull();
  });

  it('leaves what is with agents out of what is left, in the header and the sidebar', () => {
    const rows = [
      task('working', { status: 'doing', dueDate: DAY, sessionIds: ['running'] }),
      task('asking', { status: 'doing', dueDate: DAY, sessionIds: ['waiting'] }),
      task('plain', { dueDate: DAY }),
    ];
    const withAgents = withAgentsOf(rows, SESSIONS);
    expect([...withAgents]).toEqual(['working']);
    expect(todoCounts(todoEntries(rows, DAY, { today: DAY, overdue: true }), withAgents)).toEqual({
      left: 2,
      done: 0,
    });
    expect(todayOpenCount(rows, DAY, withAgents)).toBe(2);
  });
});

describe("TODO's Move", () => {
  const options = { today: DAY, overdue: true };

  it('is held by a deadline on the day shown or overdue, which a new TODO day would not lift', () => {
    expect(heldByDeadline(task('t', { dueDate: DAY, focusDate: DAY }), DAY, options)).toBe(true);
    expect(heldByDeadline(task('t', { dueDate: '2026-11-02' }), DAY, options)).toBe(true);
  });

  it('is free for a task on the day by its TODO day alone, or overdue with overdue left out', () => {
    expect(heldByDeadline(task('t', { focusDate: DAY, dueDate: '2026-11-20' }), DAY, options)).toBe(
      false,
    );
    expect(
      heldByDeadline(task('t', { dueDate: '2026-11-02' }), DAY, { today: DAY, overdue: false }),
    ).toBe(false);
  });
});
