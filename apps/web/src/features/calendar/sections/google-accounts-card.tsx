import {
  BrandGlyph,
  Button,
  CalendarAccountAdd,
  CalendarAccountList,
  CalendarAccountRow,
  SidebarListHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import type { GoogleCalendarConnectionEntity } from '@oppenheimer/frontend-consumer';
import {
  useGoogleCalendarConnections,
  useLatestGoogleCalendarRead,
  useRemoveGoogleCalendarConnection,
  useStartGoogleCalendarConnection,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog, ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { GOOGLE_CALENDAR_ACCOUNTS_MAX } from '@oppenheimer/shared/schemas/calendar';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleAccountStatus } from '../components/google-account-status';
import { accentOf, accountRowState } from '../lib/google-accounts';

/**
 * The viewer's Google accounts (`23-plan-milestones-stats-accounts.md` §5):
 * read-only, so connecting asks Google for the read scope alone. Each account
 * with its colour on the month and how its last read went, Reconnect when
 * Google dropped it, Remove behind a confirm, and Add account up to five.
 * With none yet, the card that explains and connects. Nothing on a deployment
 * with no Google credentials.
 */
export function GoogleAccountsCard() {
  const { t } = useTranslation();
  const { data: available } = useDeploymentCapabilities({
    select: (deployment) => deployment.google_calendar,
  });
  const connections = useGoogleCalendarConnections();
  const { read, updatedAt } = useLatestGoogleCalendarRead();
  const start = useStartGoogleCalendarConnection();
  const [removing, setRemoving] = useState<GoogleCalendarConnectionEntity | null>(null);
  const remove = useRemoveGoogleCalendarConnection({ onSuccess: () => setRemoving(null) });
  if (!available) return null;
  const readOf = (id: string) => read?.accounts.find((account) => account.id === id)?.status;

  return (
    <section aria-label={t('calendar.google.accounts')} className="flex flex-col">
      <SidebarListHead label={t('calendar.google.accounts')} />
      <div className="mx-3 flex flex-col gap-2">
        <QueryState
          query={connections}
          pending={<Skeleton className="h-16 w-full" />}
          errorFallback={t('calendar.google.loadFailed')}
        >
          {(rows) =>
            rows.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-md bg-hover-surface p-3">
                <span className="flex items-center gap-2 text-sm font-medium text-fg [&_svg]:size-3.25">
                  <BrandGlyph name="google" />
                  {t('calendar.google.title')}
                </span>
                <p className="text-xs text-fg-muted">{t('calendar.google.description')}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  pending={start.isPending}
                  onClick={() => start.mutate(undefined)}
                >
                  {t('calendar.google.connect')}
                </Button>
              </div>
            ) : (
              <CalendarAccountList>
                {rows.map((connection) => {
                  const state = accountRowState(connection, readOf(connection.id));
                  return (
                    <CalendarAccountRow
                      key={connection.id}
                      mark={<BrandGlyph name="google" />}
                      account={connection.accountEmail}
                      accent={accentOf(connection.colorIndex)}
                      status={<GoogleAccountStatus state={state} updatedAt={updatedAt} />}
                      failed={state !== 'connected'}
                      onReconnect={
                        state === 'revoked' ? () => start.mutate(connection.id) : undefined
                      }
                      onDisconnect={() => setRemoving(connection)}
                      labels={{
                        reconnect: t('calendar.google.reconnect'),
                        disconnect: (email) => t('calendar.google.removeLabel', { email }),
                      }}
                    />
                  );
                })}
                <CalendarAccountAdd
                  disabled={start.isPending || rows.length >= GOOGLE_CALENDAR_ACCOUNTS_MAX}
                  title={
                    rows.length >= GOOGLE_CALENDAR_ACCOUNTS_MAX
                      ? t('calendar.google.atLimit', { count: GOOGLE_CALENDAR_ACCOUNTS_MAX })
                      : undefined
                  }
                  onClick={() => start.mutate(undefined)}
                >
                  {t('calendar.google.add')}
                </CalendarAccountAdd>
              </CalendarAccountList>
            )
          }
        </QueryState>
        <ErrorAlert
          error={start.error}
          fallback={t('calendar.google.startFailed')}
          onDismiss={start.reset}
        />
      </div>
      {removing ? (
        <ConfirmDialog
          title={t('calendar.google.removeTitle')}
          description={t('calendar.google.removeDescription', { email: removing.accountEmail })}
          confirmLabel={t('calendar.google.remove')}
          pending={remove.isPending}
          error={remove.error}
          errorFallback={t('calendar.google.removeFailed')}
          onClose={() => setRemoving(null)}
          onConfirm={() => remove.mutate(removing.id)}
        />
      ) : null}
    </section>
  );
}
