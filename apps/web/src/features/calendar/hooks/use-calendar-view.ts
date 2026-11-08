import { monthOf } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { DEFAULT_VIEW, viewDays } from '../lib/calendar-view';
import { useToday } from './use-today';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * What the address shows: the view (Day when it names none), its anchor day
 * (today when it names none), the month the Month view draws, the days the
 * view draws and the range they cover, and whether a day is the view's own
 * (the month's days rather than the weeks around it).
 */
export function useCalendarView() {
  const { view = DEFAULT_VIEW, date, month } = calendar.useSearch();
  const today = useToday();
  const anchor = date ?? (month && month !== monthOf(today) ? `${month}-01` : today);
  const shownMonth = month ?? monthOf(anchor);
  const days = viewDays(view, anchor, shownMonth);
  const range = { from: days[0], to: days[days.length - 1] };
  const inView = (day: string) =>
    view === 'month' ? day.startsWith(`${shownMonth}-`) : day >= range.from && day <= range.to;
  return { view, anchor, month: shownMonth, today, days, range, inView };
}
