import { dateFormatter } from '@oppenheimer/frontend-web';

const DAY_MS = 86_400_000;

function startOfDay(at: number): number {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** When a bot was last active, as a sidebar row says it: formatted text, or a day the caller words. */
export type BotRowTime = { kind: 'text'; text: string } | { kind: 'yesterday' };

/**
 * When a bot was last active, the way a messaging app's chat list says it:
 * the time today ("09:28"), yesterday the day before, the weekday within the
 * week ("Mon"), the date before that ("Nov 3"), with the year once it is
 * another year's. Days are the reader's own.
 */
export function botRowTime(at: Date, now: number, locale: string): BotRowTime {
  const days = Math.round((startOfDay(now) - startOfDay(at.getTime())) / DAY_MS);
  if (days === 1) return { kind: 'yesterday' };
  const options: Intl.DateTimeFormatOptions =
    days <= 0
      ? { timeStyle: 'short' }
      : days < 7
        ? { weekday: 'short' }
        : new Date(now).getFullYear() === at.getFullYear()
          ? { month: 'short', day: 'numeric' }
          : { dateStyle: 'medium' };
  return { kind: 'text', text: dateFormatter(locale, options).format(at) };
}
