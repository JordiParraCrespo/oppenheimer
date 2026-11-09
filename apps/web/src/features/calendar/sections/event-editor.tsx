import type { CalendarEventEntity } from '@oppenheimer/frontend-consumer';
import {
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventForm, type EventFormValues } from '../forms/event-form';
import { useCalendarView } from '../hooks/use-calendar-view';
import { addMinutes } from '../lib/calendar-view';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The event form and its writes: a new event on `?day=` (or today) when
 * `event` is `null`, or the saved one to change or delete, behind a confirm.
 * Every write closes the dialog by clearing the address.
 */
export function EventEditor({ event }: { event: CalendarEventEntity | null }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { day, at } = calendar.useSearch();
  const navigate = calendar.useNavigate();
  const { today } = useCalendarView();
  const [deleting, setDeleting] = useState(false);
  const voice = useVoiceDictation();
  const close = () =>
    navigate({
      search: (previous) => ({ ...previous, event: undefined, day: undefined, at: undefined }),
    });
  const create = useCreateCalendarEvent({ onSuccess: close });
  const update = useUpdateCalendarEvent({ onSuccess: close });
  const remove = useDeleteCalendarEvent({ onSuccess: close });
  const values: EventFormValues = event
    ? {
        title: event.title,
        notes: event.notes,
        date: event.date,
        allDay: event.allDay,
        startTime: event.startTime,
        endTime: event.endTime,
        busy: event.busy,
      }
    : {
        title: '',
        notes: '',
        date: day ?? today,
        allDay: false,
        startTime: at ?? '09:00',
        endTime: at ? addMinutes(at, 30) : '10:00',
        busy: true,
      };
  const failure = create.error ?? update.error;

  return (
    <>
      <EventForm
        values={values}
        today={today}
        voice={voice}
        pending={create.isPending || update.isPending}
        error={failure ? resolveError(failure, t('calendar.event.saveFailed')) : null}
        submitLabel={t(event ? 'calendar.event.save' : 'calendar.event.add')}
        onCancel={close}
        onDelete={event ? () => setDeleting(true) : undefined}
        onSubmit={(input) =>
          event ? update.mutate({ id: event.id, input }) : create.mutate(input)
        }
      />
      {deleting && event ? (
        <ConfirmDialog
          title={t('calendar.event.deleteTitle', { title: event.title })}
          description={t('calendar.event.deleteDescription')}
          confirmLabel={t('calendar.event.delete')}
          pendingLabel={t('calendar.event.deleting')}
          pending={remove.isPending}
          error={remove.error}
          errorFallback={t('calendar.event.deleteFailed')}
          onClose={() => setDeleting(false)}
          onConfirm={() => remove.mutate(event.id)}
        />
      ) : null}
    </>
  );
}
