import { TaskEntity } from '@oppenheimer/frontend-consumer';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { describe, expect, it } from 'vitest';
import { todayOpenCount, todoCounts, todoEntries } from '../lib/todo';

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
    const rows = todoEntries(TASKS, DAY, { overdue: true });
    expect(rows.map((row) => [row.task.id, row.state])).toEqual([
      ['a', 'done'],
      ['b', 'todo'],
      ['c', 'todo'],
      ['older', 'overdue'],
      ['old', 'overdue'],
    ]);
  });

  it('leaves out overdue work when it is off, and a done task is never overdue', () => {
    expect(todoEntries(TASKS, DAY, { overdue: false }).map((row) => row.task.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('narrows to the projects the filter names', () => {
    const rows = todoEntries(TASKS, DAY, { overdue: true, projectIds: ['p-2'] });
    expect(rows.map((row) => row.task.id)).toEqual(['older']);
  });

  it('counts what is left and done, and the sidebar counts open work due by today', () => {
    expect(todoCounts(todoEntries(TASKS, DAY, { overdue: true }))).toEqual({ left: 4, done: 1 });
    expect(todayOpenCount(TASKS, DAY)).toBe(4);
  });
});
