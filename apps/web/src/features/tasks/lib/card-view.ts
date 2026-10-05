import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { daysBetween, nearDay } from '@oppenheimer/frontend-web';
import type { TaskCardView } from '../components/task-card';
import type { BoardFilter } from './board';

/**
 * A task as its card draws it: the project only under All projects, the goal
 * unless the board is filtered to it, the due date in words, and none of the
 * three extras once it is done (`18-plan-product.md` §2).
 */
export function cardView(
  task: TaskEntity,
  context: {
    filter: BoardFilter;
    today: string;
    projectName: (id: string) => string | null;
    goalName: (id: string) => string | null;
    dayLabel: (iso: string) => string;
  },
): TaskCardView {
  const { filter, today } = context;
  const due = task.dueDate && !task.isDone ? task.dueDate : null;
  const away = due ? daysBetween(today, due) : null;
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    done: task.isDone,
    projectName: filter.projectId ? null : context.projectName(task.projectId),
    goalName: task.goalId && task.goalId !== filter.goalId ? context.goalName(task.goalId) : null,
    due: due ? [context.dayLabel(due), task.dueTime].filter(Boolean).join(' · ') : null,
    dueTone: away === null ? 'later' : away < 0 ? 'overdue' : away <= 1 ? 'soon' : 'later',
  };
}

/** `Today`, `Tomorrow`, `Yesterday` or `Oct 7`: the words a due date reads as. */
export function dueDayLabel(
  iso: string,
  today: string,
  words: { today: string; tomorrow: string; yesterday: string },
  format: (iso: string) => string,
): string {
  const near = nearDay(iso, today);
  return near ? words[near] : format(iso);
}
