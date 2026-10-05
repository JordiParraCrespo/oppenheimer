import type {
  AutomationEntity,
  CalendarEventEntity,
  TaskEntity,
} from '@oppenheimer/frontend-consumer';
import { todayIn } from '@oppenheimer/frontend-web';
import { nextScheduleOccurrence } from '@oppenheimer/shared/automations';
import type { CalendarLayer } from './calendar-search';

/**
 * One thing on one day of the month: a personal event, a Google event, a task
 * due, or an automation's scheduled run. Times are wall-clock in the reader's
 * zone; an all-day item has none.
 */
export interface CalendarItem {
  key: string;
  layer: CalendarLayer;
  /** The id the item opens: the event, the task, the automation. */
  id: string;
  day: string;
  time: string | null;
  title: string;
  /** A Google event's page; nothing else links out. */
  url: string | null;
  done?: boolean;
}

/** The most runs one automation puts on a month: an hourly rule would bury the grid. */
const MAX_RUNS = 62;

export function eventItems(
  events: readonly CalendarEventEntity[],
  layer: 'events' | 'google',
): CalendarItem[] {
  return events.map((event) => ({
    key: `${layer}:${event.id}:${event.date}`,
    layer,
    id: event.id,
    day: event.date,
    time: event.allDay ? null : event.startTime,
    title: event.title,
    url: event.url,
  }));
}

export function taskItems(tasks: readonly TaskEntity[], from: string, to: string): CalendarItem[] {
  return tasks.flatMap((task) =>
    task.dueDate && task.dueDate >= from && task.dueDate <= to
      ? [
          {
            key: `tasks:${task.id}`,
            layer: 'tasks' as const,
            id: task.id,
            day: task.dueDate,
            time: task.dueTime,
            title: task.title,
            url: null,
            done: task.isDone,
          },
        ]
      : [],
  );
}

/**
 * The scheduled runs of active automations between two days, computed here
 * from each schedule trigger's rule and zone (`20-plan-calendar.md` §1):
 * the API serves the rules, and the same arithmetic the scheduler runs
 * (`nextScheduleOccurrence`) places them. Hourly rules are left off.
 */
export function automationItems(
  automations: readonly AutomationEntity[],
  from: string,
  to: string,
): CalendarItem[] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59`);
  return automations.flatMap((automation) => {
    if (automation.status === 'paused') return [];
    return automation.triggers.flatMap((trigger) => {
      if (trigger.source !== 'schedule' || trigger.frequency === 'hourly') return [];
      const items: CalendarItem[] = [];
      let after = new Date(start.getTime() - 1);
      for (let count = 0; count < MAX_RUNS; count += 1) {
        const next = nextScheduleOccurrence(trigger, after);
        if (!next || next > end) break;
        items.push({
          key: `automations:${automation.id}:${next.getTime()}`,
          layer: 'automations',
          id: automation.id,
          day: todayIn(next.getTime()),
          time: `${pad(next.getHours())}:${pad(next.getMinutes())}`,
          title: automation.name,
          url: null,
        });
        after = next;
      }
      return items;
    });
  });
}

/** The items of each day, all-day first, then by time. */
export function byDay(items: readonly CalendarItem[]): Map<string, CalendarItem[]> {
  const days = new Map<string, CalendarItem[]>();
  for (const item of items) days.set(item.day, [...(days.get(item.day) ?? []), item]);
  for (const list of days.values()) {
    list.sort(
      (a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title),
    );
  }
  return days;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
