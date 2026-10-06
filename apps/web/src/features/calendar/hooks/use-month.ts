import { monthGridDays, monthOf } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useToday } from './use-today';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/** The month the address names (this one when it names none), and the days its grid draws. */
export function useMonth() {
  const { month } = calendar.useSearch();
  const today = useToday();
  const shown = month ?? monthOf(today);
  const days = monthGridDays(shown);
  return { month: shown, today, days, range: { from: days[0], to: days[days.length - 1] } };
}
