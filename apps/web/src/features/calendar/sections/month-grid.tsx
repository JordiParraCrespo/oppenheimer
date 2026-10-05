import { CalendarEntry, DragProvider, MonthCalendar } from '@oppenheimer/design-system-web';
import {
  useAutomations,
  useCalendarEvents,
  useGoogleCalendarConnection,
  useGoogleCalendarEvents,
  useTasks,
  useUpdateCalendarEvent,
  useUpdateTask,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useDragLabels, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMonth } from '../hooks/use-month';
import {
  automationItems,
  type CalendarItem,
  eventItems,
  taskItems,
  toEntry,
} from '../lib/calendar-items';
import { hiddenLayers, NEW_EVENT } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The month (`20-plan-calendar.md` §2) on the design system's calendar: the
 * items of the layers that are on — personal events, Google's, tasks due,
 * scheduled automation runs. A personal event opens its dialog, a task its
 * card on the board, an automation its page, a Google event Google. A
 * personal event or a task dragged onto another day moves there.
 */
export function MonthGrid() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dragLabels = useDragLabels();
  const { off } = calendar.useSearch();
  const navigate = calendar.useNavigate();
  const go = useNavigate();
  const { month, today, range } = useMonth();
  const hidden = hiddenLayers(off);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const events = useCalendarEvents(range);
  const connection = useGoogleCalendarConnection();
  const google = useGoogleCalendarEvents(
    range,
    timeZone,
    hidden.has('google') ? undefined : connection.data,
  );
  const { data: tasks } = useTasks({ select: (rows) => taskItems(rows, range.from, range.to) });
  const { data: automations } = useAutomations({
    select: (rows) => automationItems(rows, range.from, range.to),
  });
  const moveEvent = useUpdateCalendarEvent();
  const moveTask = useUpdateTask();

  const items: CalendarItem[] = [
    ...(hidden.has('events') ? [] : eventItems(events.data ?? [], 'events')),
    ...(hidden.has('google') ? [] : eventItems(google.data ?? [], 'google')),
    ...(hidden.has('tasks') ? [] : (tasks ?? [])),
    ...(hidden.has('automations') ? [] : (automations ?? [])),
  ];
  const byKey = new Map(items.map((item) => [item.key, item]));
  const [year, monthNumber] = month.split('-').map(Number);

  const open = (key: string) => {
    const item = byKey.get(key);
    if (!item) return;
    if (item.layer === 'events')
      navigate({ search: (previous) => ({ ...previous, event: item.id }) });
    else if (item.layer === 'tasks') go({ to: '/plan', search: { task: item.id } });
    else if (item.layer === 'automations')
      go({ to: '/automations/$automationId', params: { automationId: item.id } });
    else if (item.url) window.open(item.url, '_blank', 'noopener');
  };

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert error={events.error} fallback={t('calendar.grid.eventsFailed')} />
      <ErrorAlert error={google.error} fallback={t('calendar.grid.googleFailed')} />
      <ErrorAlert
        error={moveEvent.error ?? moveTask.error}
        fallback={t('calendar.grid.moveFailed')}
      />
      <DragProvider
        labels={dragLabels}
        overlay={(active) => {
          const item = byKey.get(active.id);
          return item ? <CalendarEntry entry={toEntry(item)} lifted /> : null;
        }}
        onDragEnd={({ active, over }) => {
          const item = byKey.get(active.id);
          if (!item || !over || over.id === item.day) return;
          if (item.layer === 'events') moveEvent.mutate({ id: item.id, input: { date: over.id } });
          if (item.layer === 'tasks') moveTask.mutate({ id: item.id, input: { dueDate: over.id } });
        }}
      >
        <MonthCalendar
          year={year}
          month={monthNumber - 1}
          entries={items.map(toEntry)}
          today={today}
          locale={locale}
          onOpenEntry={open}
          onAddDay={(day) =>
            navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day }) })
          }
          moreLabel={(count) => t('calendar.grid.more', { count })}
          closeLabel={t('common.close')}
        />
      </DragProvider>
    </div>
  );
}
