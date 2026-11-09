import { TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { describe, expect, it } from 'vitest';
import {
  addableTasks,
  todayOpenCount,
  todoCounts,
  todoDay,
  todoEntries,
  todoLabels,
  todoSearchSchema,
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
    [],
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
    ]);
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
    expect(todoCounts(todoEntries(TASKS, DAY, { today: DAY, overdue: true }))).toEqual({
      left: 4,
      done: 1,
    });
    expect(todayOpenCount(TASKS, DAY)).toBe(4);
    expect(todayOpenCount([...TASKS, task('planned', { focusDate: DAY })], DAY)).toBe(5);
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
    expect(addableTasks(rows, new Set(), ['p-2']).map((row) => row.id)).toEqual(['d']);
  });
});
