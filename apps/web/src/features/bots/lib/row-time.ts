import { dateFormatter } from '@oppenheimer/frontend-web';

const DAY_MS = 86_400_000;

function startOfDay(at: number): number {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * When a bot was last active, the way a messaging app's chat list says it:
 * the time today ("09:28"), `yesterday` the day before (the caller words it),
 * the weekday within the week ("Mon"), the date before that ("Nov 3"), with
 * the year once it is another year's. Days are the reader's own.
 */
export function botRowTime(at: Date, now: number, locale: string): string | 'yesterday' {
  const days = Math.round((startOfDay(now) - startOfDay(at.getTime())) / DAY_MS);
  if (days <= 0) return dateFormatter(locale, { timeStyle: 'short' }).format(at);
  if (days === 1) return 'yesterday';
  if (days < 7) return dateFormatter(locale, { weekday: 'short' }).format(at);
  const sameYear = new Date(now).getFullYear() === at.getFullYear();
  return dateFormatter(
    locale,
    sameYear ? { month: 'short', day: 'numeric' } : { dateStyle: 'medium' },
  ).format(at);
}
