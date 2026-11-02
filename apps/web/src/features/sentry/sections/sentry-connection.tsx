import { Button, Callout, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import { useDisconnectSentry, useSuspenseSentryStatus } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WebhookUrlCopy } from '../components/webhook-url-copy';
import { SentryConnectionDialog } from '../dialogs/sentry-connection';

/**
 * The workspace's Sentry organization: which one is connected and the last
 * four characters of its secret, Connect or Replace secret and Disconnect,
 * and, once connected, the webhook URL to paste into the integration. How
 * to make the integration is written under it either way. A server that
 * cannot seal a secret says so above the row, whose button is then off.
 * Read under Suspense, in the screen's `QueryState`.
 */
export function SentryConnectionSection() {
  const { t } = useTranslation();
  const { data: status, error } = useSuspenseSentryStatus();
  const [editing, setEditing] = useState(false);
  const disconnect = useDisconnectSentry();
  const unavailable = status.configured ? undefined : t('settings.sentry.unavailable');
  const connection = status.connection;

  return (
    <>
      {unavailable ? <Callout className="mb-4">{unavailable}</Callout> : null}
      <ErrorAlert error={error} fallback={t('settings.sentry.loadFailed')} />
      <ErrorAlert
        error={disconnect.error}
        fallback={t('settings.sentry.disconnectFailed')}
        onDismiss={() => disconnect.reset()}
      />
      <SettingsGroup>
        <SettingsListRow
          align="center"
          data-testid="sentry-connection"
          meta={t('settings.sentry.meta')}
          kind={
            connection
              ? t('settings.sentry.connectedAs', {
                  organization: connection.organizationSlug,
                  hint: connection.secretHint,
                })
              : t('settings.sentry.notConnected')
          }
          actions={
            <>
              {connection ? (
                <Button
                  size="sm"
                  variant="ghost"
                  pending={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  {t('settings.sentry.disconnect')}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={unavailable !== undefined}
                title={unavailable}
                onClick={() => setEditing(true)}
              >
                {t(connection ? 'settings.sentry.replace' : 'settings.sentry.connect')}
              </Button>
            </>
          }
        >
          {t('settings.sentry.name')}
        </SettingsListRow>
      </SettingsGroup>
      {connection ? (
        <div className="mt-6 flex flex-col gap-2">
          <span className="text-sm text-fg">{t('settings.sentry.webhookLabel')}</span>
          <WebhookUrlCopy url={connection.webhookUrl} />
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 text-sm text-fg-muted">
        <span className="text-fg">{t('settings.sentry.stepsTitle')}</span>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          <li>{t('settings.sentry.steps.integration')}</li>
          <li>{t('settings.sentry.steps.webhook')}</li>
          <li>{t('settings.sentry.steps.events')}</li>
          <li>{t('settings.sentry.steps.secret')}</li>
          <li>{t('settings.sentry.steps.trigger')}</li>
        </ol>
      </div>
      {editing ? (
        <SentryConnectionDialog
          organizationSlug={connection?.organizationSlug ?? ''}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
