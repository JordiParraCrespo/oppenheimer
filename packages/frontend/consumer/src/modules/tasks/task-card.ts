import { daysBetween, nearDay } from '@oppenheimer/frontend-core';
import type { TaskPriority } from '@oppenheimer/shared/schemas/task';
import { type BoardFilter, soleProjectOf } from './board';
import type { TaskEntity } from './task.entity';

/** How a card's due date is drawn: red once past, strong within a day, else quiet. */
export type TaskDueTone = 'default' | 'soon' | 'overdue';

/** What a task's card or row draws, in the reader's words, on the web and the phone alike. */
export interface TaskCardView {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  /** Unless the board is filtered to that one project: the project the card is filed under. */
  projectName: string | null;
  /** Unless the board is filtered to it. */
  milestoneName: string | null;
  /** `Tomorrow · 09:00`, or null with no due date or once done. */
  due: string | null;
  dueTone: TaskDueTone;
  /** Null with none, or once done. */
  priority: TaskPriority | null;
}

/**
 * A task as its card draws it: the project unless the board shows that
 * project alone (several picked, each card still says which it is in), the
 * milestone unless the board is filtered to it, the due date in words, its
 * priority, and none of the four extras once it is done.
 */
export function cardView(
  task: TaskEntity,
  context: {
    filter: BoardFilter;
    today: string;
    projectName: (id: string) => string | null;
    milestoneName: (id: string) => string | null;
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
    projectName: soleProjectOf(filter) ? null : context.projectName(task.projectId),
    milestoneName:
      task.milestoneId && task.milestoneId !== filter.milestoneId
        ? context.milestoneName(task.milestoneId)
        : null,
    due: due ? [context.dayLabel(due), task.dueTime].filter(Boolean).join(' · ') : null,
    dueTone: away === null ? 'default' : away < 0 ? 'overdue' : away <= 1 ? 'soon' : 'default',
    priority: task.isDone ? null : task.priority,
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
