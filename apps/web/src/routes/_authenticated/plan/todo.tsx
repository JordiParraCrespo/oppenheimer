import { createFileRoute } from '@tanstack/react-router';
import { planFilterBeforeLoad } from '@/features/tasks/lib/plan-filter-memory';
import { todoSearchSchema } from '@/features/tasks/lib/todo';
import { TodoScreen } from '@/features/tasks/screens/todo';

/**
 * Plan's To do (the 2026-11-08 `Tasks` frame): one day's tasks, `?date=` the
 * day (today when absent), `?project=` narrowing it as on the board, and
 * `?overdue=off` leaving out what is overdue. A visit without a project takes
 * the one To do was last left with on this device.
 */
export const Route = createFileRoute('/_authenticated/plan/todo')({
  validateSearch: todoSearchSchema,
  beforeLoad: planFilterBeforeLoad('todo'),
  component: TodoScreen,
});
