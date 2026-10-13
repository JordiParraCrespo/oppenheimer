import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FieldDescription,
  SummaryCard,
  SummaryRow,
} from '@oppenheimer/design-system-web';
import {
  useGoogleCalendarConnections,
  useGoogleCalendarEvents,
} from '@oppenheimer/frontend-consumer/react';
import { formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GoogleAccountSwatch } from '../components/google-account-swatch';
import { useMonth } from '../hooks/use-month';
import { accentOf } from '../lib/google-accounts';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * A Google event, read-only (`23-plan-milestones-stats-accounts.md` §5): open
 * while the address says `?google=`. When it is, which account it came from,
 * in that account's colour, and a way to open it in Google Calendar, where it
 * can be changed.
 */
export function GoogleEventDialog() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { google: open } = calendar.useSearch();
  const navigate = calendar.useNavigate();
  const { range } = useMonth();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data: event } = useGoogleCalendarEvents(range, timeZone, false, {
    select: (read) => read.events.find((row) => row.id === open) ?? null,
  });
  const { data: connection } = useGoogleCalendarConnections({
    select: (rows) => rows.find((row) => row.id === event?.connectionId) ?? null,
  });
  if (!open) return null;
  const close = () => navigate({ search: (previous) => ({ ...previous, google: undefined }) });

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{event?.title || t('calendar.googleEvent.untitled')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-6">
            {event ? (
              <SummaryCard>
                <SummaryRow label={t('calendar.googleEvent.when')} mono={false}>
                  {formatCalendarDay(event.date, locale, 'long')}
                  {event.allDay
                    ? ` · ${t('calendar.event.allDay')}`
                    : ` · ${event.startTime}–${event.endTime}`}
                </SummaryRow>
                <SummaryRow label={t('calendar.googleEvent.account')}>
                  <span className="inline-flex items-center gap-1.5">
                    {connection ? (
                      <GoogleAccountSwatch accent={accentOf(connection.colorIndex)} />
                    ) : null}
                    {connection?.accountEmail ?? t('calendar.layers.google')}
                  </span>
                </SummaryRow>
                <SummaryRow label={t('calendar.googleEvent.shows')} mono={false}>
                  {t(event.busy ? 'calendar.googleEvent.busy' : 'calendar.googleEvent.free')}
                </SummaryRow>
              </SummaryCard>
            ) : (
              <FieldDescription>{t('calendar.event.gone')}</FieldDescription>
            )}
            <FieldDescription>{t('calendar.googleEvent.readOnly')}</FieldDescription>
            {event?.url ? (
              <Button
                variant="secondary"
                render={<a href={event.url} target="_blank" rel="noreferrer" />}
              >
                {t('calendar.googleEvent.open')}
              </Button>
            ) : null}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
