import { type AgendaEntryData, CalendarEntry, DragProvider } from '@oppenheimer/design-system-web';
import { useUpdateCalendarEvent, useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useDragLabels } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendarItems } from '../hooks/use-calendar-items';
import { useOpenItem } from '../hooks/use-open-item';
import { type CalendarItem, toEntry } from '../lib/calendar-items';
import type { CalendarMove } from '../lib/calendar-view';

/**
 * What Month, Day and Week share: the items of the layers that are on, the
 * reads' and the moves' failures above them, one drag surface whose lifted
 * copy is the entry, and what a click opens. A view hands in its drop
 * policy (`monthMove`, `agendaMove`: a target's id to a write, or none) and
 * draws its calendar from the entries and the open handler it is given.
 */
export function CalendarSurface({
  move,
  children,
}: {
  move: (item: CalendarItem, target: string) => CalendarMove;
  children: (entries: AgendaEntryData[], open: (key: string) => void) => ReactNode;
}) {
  const { t } = useTranslation();
  const dragLabels = useDragLabels();
  const { items, eventsError, googleError } = useCalendarItems();
  const openItem = useOpenItem();
  const moveEvent = useUpdateCalendarEvent();
  const moveTask = useUpdateTask();
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
          const write = move(item, over.id);
          if (write?.layer === 'events') moveEvent.mutate({ id: item.id, input: write.input });
          if (write?.layer === 'tasks') moveTask.mutate({ id: item.id, input: write.input });
        }}
      >
        {children(items.map(toEntry), (key) => {
          const item = byKey.get(key);
          if (item) openItem(item);
        })}
      </DragProvider>
    </div>
  );
}
