import {
  useAutomations,
  useCalendarEvents,
  useGoogleCalendarConnections,
  useGoogleCalendarEvents,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { getRouteApi } from '@tanstack/react-router';
import {
  automationItems,
  type CalendarItem,
  eventItems,
  googleItems,
  taskItems,
} from '../lib/calendar-items';
import { hiddenLayers, inProjects } from '../lib/calendar-search';
import { useCalendarProjects } from './use-calendar-projects';
import { useCalendarView } from './use-calendar-view';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * Everything the layers that are on put on the view's days — personal
 * events, Google's (each in its account's colour), tasks due and scheduled
 * automation runs, of the picked projects — and the two reads whose failure the view says.
 */
export function useCalendarItems() {
  const { off } = calendar.useSearch();
  const { projectIds } = useCalendarProjects();
  const { range } = useCalendarView();
  const hidden = hiddenLayers(off);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const events = useCalendarEvents(range);
  const { data: connections = [] } = useGoogleCalendarConnections();
  const google = useGoogleCalendarEvents(
    range,
    timeZone,
    !hidden.has('google') && connections.some((connection) => connection.isActive),
  );
  const { data: tasks } = useTasks({
    select: (rows) => taskItems(inProjects(rows, projectIds), range.from, range.to),
  });
  const { data: automations } = useAutomations({
    select: (rows) => automationItems(inProjects(rows, projectIds), range.from, range.to),
  });

  const items: CalendarItem[] = [
    ...(hidden.has('events') ? [] : eventItems(events.data ?? [], 'events')),
    ...(hidden.has('google') ? [] : googleItems(google.data?.events ?? [], connections)),
    ...(hidden.has('tasks') ? [] : (tasks ?? [])),
    ...(hidden.has('automations') ? [] : (automations ?? [])),
  ];
  return { items, eventsError: events.error, googleError: google.error };
}
