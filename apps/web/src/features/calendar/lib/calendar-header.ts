import {
  addDays,
  dateFormatter,
  formatCalendarMonth,
  isoWeek,
  shiftMonth,
} from '@oppenheimer/frontend-web';
import type { CalendarView } from './calendar-view';

interface Shown {
  view: CalendarView;
  anchor: string;
  month: string;
  range: { from: string; to: string };
  today: string;
}

/** "octubre de 2026" reads "Octubre de 2026" as a title. */
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * The header's title: the month ("November 2026"), the day ("Sunday,
 * November 8") or the week's span ("November 2 – 8", "Oct 26 – Nov 1"),
 * with the year only outside this one.
 */
export function headerTitle(shown: Shown, locale: string): string {
  if (shown.view === 'month') return capitalized(formatCalendarMonth(shown.month, locale));
  const year =
    shown.anchor.slice(0, 4) === shown.today.slice(0, 4) ? {} : { year: 'numeric' as const };
  if (shown.view === 'day') {
    const format = dateFormatter(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      ...year,
      timeZone: 'UTC',
    });
    return capitalized(format.format(utc(shown.anchor)));
  }
  const oneMonth = shown.range.from.slice(5, 7) === shown.range.to.slice(5, 7);
  const format = dateFormatter(locale, {
    month: oneMonth ? 'long' : 'short',
    day: 'numeric',
    ...year,
    timeZone: 'UTC',
  });
  return capitalized(format.formatRange(utc(shown.range.from), utc(shown.range.to)));
}

/**
 * The eyebrow over the title, as a translation key and its values: Weeks
 * 44–49 over a month, Today · Week 45 on today, Week 45 on any other day or
 * week.
 */
export function headerEyebrow(
  shown: Shown,
):
  | { key: 'calendar.header.weeks'; values: { from: number; to: number } }
  | { key: 'calendar.header.todayWeek' | 'calendar.header.weekNumber'; values: { week: number } } {
  if (shown.view === 'month') {
    const last = addDays(`${shiftMonth(shown.month, 1)}-01`, -1);
    return {
      key: 'calendar.header.weeks',
      values: { from: isoWeek(`${shown.month}-01`), to: isoWeek(last) },
    };
  }
  const week = isoWeek(shown.anchor);
  return shown.view === 'day' && shown.anchor === shown.today
    ? { key: 'calendar.header.todayWeek', values: { week } }
    : { key: 'calendar.header.weekNumber', values: { week } };
}
