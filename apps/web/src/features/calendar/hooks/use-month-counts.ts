import {
  useAutomations,
  useCalendarEvents,
  useGoogleCalendarConnections,
  useGoogleCalendarEvents,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { automationItems, taskItems } from '../lib/calendar-items';
import { useMonth } from './use-month';

/**
 * The header's line under the month (the 2026-10-13 `Tasks` frame): meetings
 * (personal and Google's), tasks due and automation runs on the month's own
 * days, whatever layers are on. The same reads the month draws from, so they
 * cost nothing more. Undefined until the month's own events have arrived.
 */
export function useMonthCounts() {
  const { month, range } = useMonth();
  const inMonth = (day: string) => day.startsWith(`${month}-`);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data: events } = useCalendarEvents(range);
  const { data: connections = [] } = useGoogleCalendarConnections();
  const google = useGoogleCalendarEvents(
    range,
    timeZone,
    connections.some((connection) => connection.isActive),
  );
  const { data: due } = useTasks({
    select: (rows) => taskItems(rows, range.from, range.to).filter((item) => inMonth(item.day)),
  });
  const { data: runs } = useAutomations({
    select: (rows) =>
      automationItems(rows, range.from, range.to).filter((item) => inMonth(item.day)),
  });
  if (!events) return undefined;
  const meetings = [...events, ...(google.data?.events ?? [])].filter((event) =>
    inMonth(event.date),
  ).length;
  return { meetings, due: due?.length ?? 0, runs: runs?.length ?? 0 };
}
