import { addDays, monthGridDays, shiftMonth, weekdayOf } from '@oppenheimer/frontend-web';

/** How the calendar reads (the 2026-11-08 `Tasks` frame): a day on the hours, a week, or the month. */
export const CALENDAR_VIEWS = ['day', 'week', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** The view an address that names none opens on: the frame's, today on the hours. */
export const DEFAULT_VIEW: CalendarView = 'day';

/**
 * What one view draws around its anchor day: the day itself, the Monday to
 * Sunday week holding it, or the whole weeks of its month (`month` wins
 * there, so the month stays put while the anchor is elsewhere).
 */
export function viewDays(view: CalendarView, anchor: string, month: string): string[] {
  if (view === 'month') return monthGridDays(month);
  if (view === 'day') return [anchor];
  const monday = addDays(anchor, -weekdayOf(anchor));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Where previous (`-1`) or next (`1`) goes: the month before or after on
 * Month, the day or week before or after on Day and Week.
 */
export function step(
  view: CalendarView,
  at: { anchor: string; month: string },
  by: -1 | 1,
): { date?: string; month?: string } {
  if (view === 'month') return { month: shiftMonth(at.month, by) };
  return { date: addDays(at.anchor, view === 'week' ? 7 * by : by) };
}

/** "10:00" plus minutes, held inside the day (23:59 at most). */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** The last minute a moved block may start at so it still ends inside the day. */
const DAY_END = 23 * 60 + 59;

/** The write a drop makes, or null when it makes none. */
export type CalendarMove =
  | {
      layer: 'events';
      input: { date: string; allDay?: boolean; startTime?: string; endTime?: string };
    }
  | { layer: 'tasks'; input: { dueDate: string; dueTime?: string | null } }
  | null;

interface Moved {
  layer: 'events' | 'google' | 'tasks' | 'automations';
  day: string;
  time: string | null;
  end: string | null;
  allDay?: boolean;
}

/**
 * The write a drop on Day or Week makes (`20-plan-calendar.md`, Day and
 * Week): onto a half hour, a personal event keeps its length and starts
 * there (an all-day one becomes an hour), a task is due there at that time;
 * onto All day, an event changes day only and a task drops its time. Google's
 * events and automation runs never move; a drop where it already is writes
 * nothing.
 */
export function agendaMove(
  item: Moved,
  target: { date: string; time: string | null },
): CalendarMove {
  if (item.layer === 'tasks') {
    if (target.date === item.day && target.time === item.time) return null;
    return { layer: 'tasks', input: { dueDate: target.date, dueTime: target.time } };
  }
  if (item.layer !== 'events') return null;
  if (!target.time)
    return target.date === item.day ? null : { layer: 'events', input: { date: target.date } };
  if (!item.allDay && target.date === item.day && target.time === item.time) return null;
  const length =
    !item.allDay && item.time && item.end
      ? Math.max(15, minutesOf(item.end) - minutesOf(item.time))
      : 60;
  const start = Math.min(minutesOf(target.time), DAY_END - length);
  return {
    layer: 'events',
    input: {
      date: target.date,
      allDay: false,
      startTime: addMinutes('00:00', start),
      endTime: addMinutes('00:00', start + length),
    },
  };
}

/**
 * The write a drop on the month makes: a personal event or a task changes
 * day and keeps its time; Google's events and automation runs never move,
 * and a drop on its own day writes nothing.
 */
export function monthMove(item: Moved, date: string): CalendarMove {
  if (date === item.day) return null;
  if (item.layer === 'events') return { layer: 'events', input: { date } };
  if (item.layer === 'tasks') return { layer: 'tasks', input: { dueDate: date } };
  return null;
}
