import { dateFormatter, viewerTimeZone } from '@oppenheimer/frontend-web';
import { wallTimeAt } from '@oppenheimer/shared/automations';

/**
 * Time as the automations pages print it. Every instant arrives in UTC and is
 * shown in the viewer's zone; the only wall times that are not the viewer's
 * are a schedule's own, which it keeps in the zone it was set in.
 */

const pad2 = (value: number) => String(value).padStart(2, '0');

export { pad2 };

/** "Sep 28": the runs list's date column and the chart's axis. */
export function monthDay(at: Date, locale: string, timeZone = viewerTimeZone()): string {
  return dateFormatter(locale, { month: 'short', day: 'numeric', timeZone }).format(at);
}

/** The `YYYY-MM-DD` local date of an instant in a zone. */
export function localDate(at: number, timeZone: string): string {
  const wall = wallTimeAt(at, timeZone);
  return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}`;
}
