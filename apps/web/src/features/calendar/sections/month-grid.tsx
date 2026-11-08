import { CalendarEntry, DragProvider, MonthCalendar } from '@oppenheimer/design-system-web';
import { useUpdateCalendarEvent, useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useDragLabels, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCalendarItems } from '../hooks/use-calendar-items';
import { useCalendarView } from '../hooks/use-calendar-view';
import { useOpenItem } from '../hooks/use-open-item';
import { toEntry } from '../lib/calendar-items';
import { NEW_EVENT } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The month (`20-plan-calendar.md` §2) on the design system's calendar: the
 * items of the layers that are on. A personal event or a task dragged onto
 * another day moves there; a day's number opens that day on the hours.
 */
export function MonthGrid() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dragLabels = useDragLabels();
  const navigate = calendar.useNavigate();
  const { month, today } = useCalendarView();
  const { items, eventsError, googleError } = useCalendarItems();
  const openItem = useOpenItem();
  const moveEvent = useUpdateCalendarEvent();
  const moveTask = useUpdateTask();
  const byKey = new Map(items.map((item) => [item.key, item]));
  const [year, monthNumber] = month.split('-').map(Number);

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert error={eventsError} fallback={t('calendar.grid.eventsFailed')} />
      <ErrorAlert error={googleError} fallback={t('calendar.grid.googleFailed')} />
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
          onOpenEntry={(key) => {
            const item = byKey.get(key);
            if (item) openItem(item);
          }}
          onAddDay={(day) =>
            navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day }) })
          }
          onOpenDay={(date) =>
            navigate({
              search: (previous) => ({
                ...previous,
                view: undefined,
                month: undefined,
                date: date === today ? undefined : date,
              }),
            })
          }
          moreLabel={(count) => t('calendar.grid.more', { count })}
          closeLabel={t('common.close')}
        />
      </DragProvider>
    </div>
  );
}
