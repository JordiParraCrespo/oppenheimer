import { TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { describe, expect, it } from 'vitest';
import { todayOpenCount, todoCounts, todoDay, todoEntries, todoStateLabel } from '../lib/todo';

function task(
  id: string,
  overrides: Partial<{
    status: TaskStatus;
    projectId: string;
    dueDate: string | null;
    dueTime: string | null;
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
    overrides.status === 'done' ? new Date('2026-11-01T00:00:00Z') : null,
    [],
    new Date('2026-11-01T00:00:00Z'),
    new Date('2026-11-01T00:00:00Z'),
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
  it('lists the day by time, then the rest in board order, then what is overdue, oldest first', () => {
    const rows = todoEntries(TASKS, DAY, { today: DAY, overdue: true });
    expect(rows.map((row) => [row.task.id, row.state])).toEqual([
      ['a', 'done'],
      ['b', 'todo'],
      ['c', 'todo'],
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
    expect(ahead.map((row) => [row.task.id, row.state])).toEqual([
      ['older', 'overdue'],
      ['old', 'overdue'],
    ]);
    expect(
      todoEntries(TASKS, '2026-11-02', { today: DAY, overdue: true }).map((row) => row.task.id),
    ).toEqual(['old']);
  });

  it('counts what is left and done, and the sidebar counts open work due by today', () => {
    expect(todoCounts(todoEntries(TASKS, DAY, { today: DAY, overdue: true }))).toEqual({
      left: 4,
      done: 1,
    });
    expect(todayOpenCount(TASKS, DAY)).toBe(4);
  });

  it('tells a narrowed empty day from an empty one', () => {
    const narrowed = todoDay(TASKS, DAY, { today: DAY, overdue: false, projectIds: ['p-9'] });
    expect(narrowed).toEqual({ entries: [], dayHasAny: true });
    expect(todoDay(TASKS, '2026-12-01', { today: DAY, overdue: false }).dayHasAny).toBe(false);
  });

  it('says due today only on today', () => {
    const [, open] = todoEntries(TASKS, DAY, { today: DAY, overdue: false });
    expect(todoStateLabel(open, DAY, DAY)).toEqual({ key: 'tasks.todo.state.todo' });
    expect(todoStateLabel(open, DAY, '2026-11-07')).toEqual({ key: 'tasks.todo.state.due' });
    const overdue = { task: TASKS[3], state: 'overdue' as const };
    expect(todoStateLabel(overdue, DAY, DAY)).toEqual({
      key: 'tasks.todo.state.overdue',
      date: '2026-11-02',
    });
  });
});
