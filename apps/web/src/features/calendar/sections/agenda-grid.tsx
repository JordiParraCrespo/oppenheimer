import {
  AgendaCalendar,
  agendaSlot,
  CalendarEntry,
  DragProvider,
  useNow,
} from '@oppenheimer/design-system-web';
import { useUpdateCalendarEvent, useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useDragLabels, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCalendarItems } from '../hooks/use-calendar-items';
import { useCalendarView } from '../hooks/use-calendar-view';
import { useOpenItem } from '../hooks/use-open-item';
import { toEntry } from '../lib/calendar-items';
import { NEW_EVENT } from '../lib/calendar-search';
import { agendaMove } from '../lib/calendar-view';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * Day and Week (the 2026-11-08 `Tasks` frame) on the design system's
 * agenda: the same items as the month, timed ones on the hours and the rest
 * in All day. A personal event or a task dragged onto a half hour moves
 * there (`agendaMove`); an empty half hour opens New event at that time; a
 * day's head opens that day.
 */
export function AgendaGrid() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dragLabels = useDragLabels();
  const navigate = calendar.useNavigate();
  const { days, today } = useCalendarView();
  const { items, eventsError, googleError } = useCalendarItems();
  const openItem = useOpenItem();
  const moveEvent = useUpdateCalendarEvent();
  const moveTask = useUpdateTask();
  const clock = new Date(useNow(60_000));
  const now = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;
  const byKey = new Map(items.map((item) => [item.key, item]));

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
          if (!item || !over) return;
          const move = agendaMove(item, agendaSlot(over.id));
          if (move?.layer === 'events') moveEvent.mutate({ id: item.id, input: move.input });
          if (move?.layer === 'tasks') moveTask.mutate({ id: item.id, input: move.input });
        }}
      >
        <AgendaCalendar
          days={days}
          entries={items.map(toEntry)}
          today={today}
          now={now}
          locale={locale}
          allDayLabel={t('calendar.grid.allDay')}
          onOpenEntry={(key) => {
            const item = byKey.get(key);
            if (item) openItem(item);
          }}
          onOpenDay={(date) =>
            navigate({
              search: (previous) => ({
                ...previous,
                view: undefined,
                date: date === today ? undefined : date,
              }),
            })
          }
          onAddSlot={(day, at) =>
            navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day, at }) })
          }
        />
      </DragProvider>
    </div>
  );
}
