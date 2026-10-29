import { Button, Callout, EmptyState, SettingsGroup } from '@oppenheimer/design-system-web';
import { Mail } from '@oppenheimer/design-system-web/icons';
import {
  useStartGmailConnection,
  useSuspenseGmailConnections,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { GMAIL_ACCOUNTS_MAX } from '@oppenheimer/shared/schemas/mail';
import { useTranslation } from 'react-i18next';
import { GmailAccountRow } from '@/features/mail/sections/gmail-account-row';

/**
 * The reader's Gmail accounts, one row each, and Connect Gmail up to five.
 * With none yet, the card that says what connecting gives the bots. A server
 * without the Google client or `MAIL_TOKEN_KEY` says so, and Connect is off
 * with that as its reason. Read under Suspense, in the screen's `QueryState`;
 * a refetch that fails keeps the rows and says so above them.
 */
export function GmailAccounts() {
  const { t } = useTranslation();
  const { data: rows, error } = useSuspenseGmailConnections();
  const { data: available } = useDeploymentCapabilities({
    select: (deployment) => deployment.gmail,
  });
  const start = useStartGmailConnection();
  const unavailable = available === false ? t('settings.mail.unavailable') : undefined;
  const atLimit = rows.length >= GMAIL_ACCOUNTS_MAX;

  const connect = (
    <Button
      variant={rows.length === 0 ? 'primary' : 'secondary'}
      size="sm"
      pending={start.isPending && start.variables === undefined}
      disabled={unavailable !== undefined || atLimit}
      title={atLimit ? t('settings.mail.atLimit', { count: GMAIL_ACCOUNTS_MAX }) : unavailable}
      onClick={() => start.mutate(undefined)}
    >
      {t(rows.length === 0 ? 'settings.mail.connect' : 'settings.mail.connectAnother')}
    </Button>
  );

  return (
    <>
      {unavailable ? <Callout className="mb-4">{unavailable}</Callout> : null}
      <ErrorAlert error={error} fallback={t('settings.mail.loadFailed')} />
      <ErrorAlert
        error={start.error}
        fallback={t('settings.mail.startFailed')}
        onDismiss={start.reset}
      />
      {rows.length === 0 ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Mail />
            </EmptyState.Media>
            <EmptyState.Title>{t('settings.mail.emptyTitle')}</EmptyState.Title>
            <EmptyState.Description>{t('settings.mail.emptyDescription')}</EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>{connect}</EmptyState.Content>
        </EmptyState>
      ) : (
        <>
          <SettingsGroup>
            {rows.map((connection) => (
              <GmailAccountRow key={connection.id} connection={connection} />
            ))}
          </SettingsGroup>
          <div className="mt-4 flex justify-end">{connect}</div>
        </>
      )}
    </>
  );
}
