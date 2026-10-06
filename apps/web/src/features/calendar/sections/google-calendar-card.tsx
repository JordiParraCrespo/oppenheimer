import { BrandGlyph, Button, CalendarSourceCard, Skeleton } from '@oppenheimer/design-system-web';
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendarConnection,
  useStartGoogleCalendarConnection,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog, ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The Google Calendar card (`20-plan-calendar.md` §3): read-only, so
 * Connect asks Google for the read scope alone. Connected, it is the design
 * system's source card with the account, and Disconnect; a grant Google
 * revoked asks to reconnect. Nothing on a deployment with no Google
 * credentials.
 */
export function GoogleCalendarCard() {
  const { t } = useTranslation();
  const { data: available } = useDeploymentCapabilities({
    select: (deployment) => deployment.google_calendar,
  });
  const connection = useGoogleCalendarConnection();
  const start = useStartGoogleCalendarConnection();
  const [confirming, setConfirming] = useState(false);
  const disconnect = useDisconnectGoogleCalendar({ onSuccess: () => setConfirming(false) });
  if (!available) return null;

  return (
    <section aria-label={t('calendar.google.title')} className="mx-3 flex flex-col gap-2">
      {connection.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : connection.isError ? (
        <ErrorAlert error={connection.error} fallback={t('calendar.google.loadFailed')} />
      ) : connection.data.isActive ? (
        <>
          <CalendarSourceCard
            mark={<BrandGlyph name="google" />}
            name={t('calendar.google.title')}
            account={connection.data.accountEmail ?? undefined}
            status={t('calendar.google.readOnly')}
          />
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            {t('calendar.google.disconnect')}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-md bg-hover-surface p-3">
          <span className="flex items-center gap-2 text-sm font-medium text-fg [&_svg]:size-[13px]">
            <BrandGlyph name="google" />
            {t('calendar.google.title')}
          </span>
          <p className="text-xs text-fg-muted">
            {t(
              connection.data.needsReconnect
                ? 'calendar.google.revoked'
                : 'calendar.google.description',
            )}
          </p>
          <ErrorAlert
            error={start.error}
            fallback={t('calendar.google.startFailed')}
            onDismiss={start.reset}
          />
          <Button
            variant="secondary"
            size="sm"
            pending={start.isPending}
            onClick={() => start.mutate()}
          >
            {t(
              connection.data.needsReconnect
                ? 'calendar.google.reconnect'
                : 'calendar.google.connect',
            )}
          </Button>
        </div>
      )}
      {confirming ? (
        <ConfirmDialog
          title={t('calendar.google.disconnectTitle')}
          description={t('calendar.google.disconnectDescription')}
          confirmLabel={t('calendar.google.disconnect')}
          pending={disconnect.isPending}
          error={disconnect.error}
          errorFallback={t('calendar.google.disconnectFailed')}
          onClose={() => setConfirming(false)}
          onConfirm={() => disconnect.mutate()}
        />
      ) : null}
    </section>
  );
}
