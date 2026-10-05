import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FieldDescription,
} from '@oppenheimer/design-system-web';
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventForm, type EventFormValues } from '../forms/event-form';
import { useMonth } from '../hooks/use-month';
import { NEW_EVENT } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * New event and Edit event, open while the address says `?event=`: `new` (on
 * `?day=`), or a personal event's id from the month shown. Google's events
 * are read-only and never open here.
 */
export function EventDialog() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { event: open, day } = calendar.useSearch();
  const navigate = calendar.useNavigate();
  const { today, range } = useMonth();
  const { data: event } = useCalendarEvents(range, {
    select: (rows) => rows.find((row) => row.id === open),
  });
  const [deleting, setDeleting] = useState(false);
  const close = () =>
    navigate({ search: (previous) => ({ ...previous, event: undefined, day: undefined }) });
  const create = useCreateCalendarEvent({ onSuccess: close });
  const update = useUpdateCalendarEvent({ onSuccess: close });
  const remove = useDeleteCalendarEvent({ onSuccess: close });
  if (!open) return null;

  const isNew = open === NEW_EVENT;
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
        startTime: '09:00',
        endTime: '10:00',
        busy: true,
      };
  const failure = create.error ?? update.error;

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {t(isNew ? 'calendar.event.newTitle' : 'calendar.event.editTitle')}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            {!isNew && !event ? (
              <FieldDescription>{t('calendar.event.gone')}</FieldDescription>
            ) : (
              <EventForm
                values={values}
                today={today}
                pending={create.isPending || update.isPending}
                error={failure ? resolveError(failure, t('calendar.event.saveFailed')) : null}
                submitLabel={t(isNew ? 'calendar.event.add' : 'calendar.event.save')}
                onCancel={close}
                onDelete={event ? () => setDeleting(true) : undefined}
                onSubmit={(input) =>
                  event ? update.mutate({ id: event.id, input }) : create.mutate(input)
                }
              />
            )}
          </div>
        </DialogBody>
      </DialogContent>
      {deleting && event ? (
        <ConfirmDialog
          title={t('calendar.event.deleteTitle')}
          description={t('calendar.event.deleteDescription', { title: event.title })}
          confirmLabel={t('calendar.event.delete')}
          pending={remove.isPending}
          error={remove.error}
          errorFallback={t('calendar.event.deleteFailed')}
          onClose={() => setDeleting(false)}
          onConfirm={() => remove.mutate(event.id)}
        />
      ) : null}
    </Dialog>
  );
}
