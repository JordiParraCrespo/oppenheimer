import { Button, Skeleton } from '@oppenheimer/design-system-web';
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
 * Connect asks Google for the read scope alone. Connected, it names the
 * account and offers Disconnect; a grant Google revoked asks to reconnect.
 * Nothing on a deployment with no Google credentials.
 */
export function GoogleCalendarCard() {
  const { t } = useTranslation();
  const { data: available } = useDeploymentCapabilities({
    select: (deployment) => deployment.google_calendar,
  });
  const connection = useGoogleCalendarConnection();
  const start = useStartGoogleCalendarConnection();
  const disconnect = useDisconnectGoogleCalendar({ onSuccess: () => setConfirming(false) });
  const [confirming, setConfirming] = useState(false);
  if (!available) return null;

  return (
    <section className="mx-3 flex flex-col gap-2.5 rounded-lg border border-border-subtle bg-card p-3.5">
      <h3 className="text-sm font-medium">{t('calendar.google.title')}</h3>
      {connection.isPending ? (
        <Skeleton className="h-8 w-full" />
      ) : connection.isError ? (
        <ErrorAlert error={connection.error} fallback={t('calendar.google.loadFailed')} />
      ) : connection.data.isActive ? (
        <>
          <p className="truncate text-xs text-fg-muted">
            {t('calendar.google.connectedAs', { email: connection.data.accountEmail ?? '' })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            {t('calendar.google.disconnect')}
          </Button>
        </>
      ) : (
        <>
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
        </>
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
