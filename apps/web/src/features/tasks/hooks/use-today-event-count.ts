import {
  useCalendarEvents,
  useGoogleCalendarConnections,
  useGoogleCalendarEvents,
} from '@oppenheimer/frontend-consumer/react';
import { useToday } from './use-today';

/** The viewer's own zone, which Google's events are read in. */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * How many events today holds, the workspace's own and every connected Google
 * account's: the count beside Calendar in Plan's sidebar. Undefined until the
 * reads answer.
 */
export function useTodayEventCount(): number | undefined {
  const today = useToday();
  const range = { from: today, to: today };
  const { data: own } = useCalendarEvents(range, { select: (rows) => rows.length });
  const { data: connected } = useGoogleCalendarConnections({
    select: (rows) => rows.some((row) => row.isActive),
  });
  const { data: google } = useGoogleCalendarEvents(range, TIME_ZONE, Boolean(connected), {
    select: (read) => read.events.length,
  });
  if (own === undefined) return undefined;
  return own + (connected ? (google ?? 0) : 0);
}
