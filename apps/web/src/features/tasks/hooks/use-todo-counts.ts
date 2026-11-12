import { useSessions, useTasks } from '@oppenheimer/frontend-consumer/react';
import { type TodoOptions, todoCounts } from '../lib/todo';

/**
 * A day's TODO counts, as the header and the sidebar show them (`todoCounts`):
 * what is left, what is with agents left out, and what is done. Undefined
 * until both the tasks and the sessions are read.
 */
export function useTodoCounts(day: string, options: TodoOptions) {
  const { data: sessions } = useSessions({
    select: (rows) => new Map(rows.map((row) => [row.id, row])),
  });
  const { data: counts } = useTasks({
    select: (rows) => todoCounts(rows, day, options, sessions),
  });
  return counts;
}
