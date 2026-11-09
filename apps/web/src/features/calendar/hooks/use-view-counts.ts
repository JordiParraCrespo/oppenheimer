import {
  useAutomations,
  useCalendarEvents,
  useGoogleCalendarConnections,
  useGoogleCalendarEvents,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { automationItems, taskItems } from '../lib/calendar-items';
import { useCalendarView } from './use-calendar-view';

/**
 * The header's line under the title (the `Tasks` frame): meetings (personal
 * and Google's), tasks due and automation runs on the view's own days,
 * whatever layers are on. The same reads the view draws from, so they cost
 * nothing more. Undefined until the view's own events have arrived.
 */
export function useViewCounts() {
  const { range, inView } = useCalendarView();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data: events } = useCalendarEvents(range);
  const { data: connections = [] } = useGoogleCalendarConnections();
  const google = useGoogleCalendarEvents(
    range,
    timeZone,
    connections.some((connection) => connection.isActive),
  );
  const { data: due } = useTasks({
    select: (rows) => taskItems(rows, range.from, range.to).filter((item) => inView(item.day)),
  });
  const { data: runs } = useAutomations({
    select: (rows) =>
      automationItems(rows, range.from, range.to).filter((item) => inView(item.day)),
  });
  if (!events) return undefined;
  const meetings = [...events, ...(google.data?.events ?? [])].filter((event) =>
    inView(event.date),
  ).length;
  return { meetings, due: due?.length ?? 0, runs: runs?.length ?? 0 };
}
