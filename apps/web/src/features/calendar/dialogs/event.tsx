import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NEW_EVENT } from '../lib/calendar-search';
import { EventEditor } from '../sections/event-editor';
import { SavedEventEditor } from '../sections/saved-event-editor';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * New event and Edit event, open while the address says `?event=`: `new` (on
 * `?day=`), or a personal event's id from the month shown, whose read this
 * draws the placeholder and a first failure for. Google's events are
 * read-only and never open here.
 */
export function EventDialog() {
  const { t } = useTranslation();
  const { event: open } = calendar.useSearch();
  const navigate = calendar.useNavigate();
  const close = () =>
    navigate({ search: (previous) => ({ ...previous, event: undefined, day: undefined }) });
  if (!open) return null;
  const isNew = open === NEW_EVENT;

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
            {isNew ? (
              <EventEditor event={null} />
            ) : (
              <QueryState>
                <QueryState.Pending>
                  <Skeleton className="h-60 w-full" />
                </QueryState.Pending>
                <QueryState.Error fallback={t('calendar.event.loadFailed')} />
                <QueryState.Data>
                  <SavedEventEditor eventId={open} />
                </QueryState.Data>
              </QueryState>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
