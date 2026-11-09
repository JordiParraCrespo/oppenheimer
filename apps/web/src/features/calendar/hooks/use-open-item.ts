import { getRouteApi, useNavigate } from '@tanstack/react-router';
import type { CalendarItem } from '../lib/calendar-items';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * What a click on an item opens: a personal event its dialog, a task its
 * card on the board, an automation its page, a Google event its read-only
 * view.
 */
export function useOpenItem() {
  const navigate = calendar.useNavigate();
  const go = useNavigate();
  return (item: CalendarItem) => {
    if (item.layer === 'events')
      navigate({ search: (previous) => ({ ...previous, event: item.id }) });
    else if (item.layer === 'tasks') go({ to: '/plan', search: { task: item.id } });
    else if (item.layer === 'automations')
      go({ to: '/automations/$automationId', params: { automationId: item.id } });
    else navigate({ search: (previous) => ({ ...previous, google: item.id }) });
  };
}
