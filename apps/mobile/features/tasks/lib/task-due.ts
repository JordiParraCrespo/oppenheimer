import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { dateFormatter, daysBetween, nearDay } from '@oppenheimer/frontend-core';

/** How a due date is drawn: red once past, strong within a day, else quiet. */
export type DueTone = 'overdue' | 'soon' | 'default';

/**
 * A task's due date as its row says it, as the console's card does: Today,
 * Tomorrow or Yesterday next to today, else "Nov 18", with the time when one
 * is set. None without a date, and none once the task is done.
 */
export function dueOf(
  task: TaskEntity,
  today: string,
  locale: string,
  words: { today: string; tomorrow: string; yesterday: string },
): { text: string; tone: DueTone } | null {
  if (!task.dueDate || task.isDone) return null;
  const near = nearDay(task.dueDate, today);
  const day = near
    ? words[near]
    : dateFormatter(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${task.dueDate}T00:00:00Z`),
      );
  const away = daysBetween(today, task.dueDate);
  return {
    text: [day, task.dueTime].filter(Boolean).join(' · '),
    tone: away < 0 ? 'overdue' : away <= 1 ? 'soon' : 'default',
  };
}
