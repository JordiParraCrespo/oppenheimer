import { FieldDescription } from '@oppenheimer/design-system-web';
import { useSuspenseCalendarEvents } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useMonth } from '../hooks/use-month';
import { EventEditor } from './event-editor';

/**
 * Edit event, in `EventDialog`'s `QueryState.Data`: the personal event the
 * address names, read from the month shown under Suspense. An event that is
 * gone says so instead of the form; a refetch that fails keeps the form and
 * says so above it.
 */
export function SavedEventEditor({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { range } = useMonth();
  const { data: event, error } = useSuspenseCalendarEvents(
    range,
    (rows) => rows.find((row) => row.id === eventId) ?? null,
  );

  return (
    <>
      <ErrorAlert error={error} fallback={t('calendar.event.loadFailed')} />
      {event ? (
        <EventEditor event={event} />
      ) : (
        <FieldDescription>{t('calendar.event.gone')}</FieldDescription>
      )}
    </>
  );
}
