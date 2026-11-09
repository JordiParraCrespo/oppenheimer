import { Button, Callout, EmptyState, SettingsGroup } from '@oppenheimer/design-system-web';
import { Send } from '@oppenheimer/design-system-web/icons';
import { useSuspenseTelegramSettings } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { TELEGRAM_ACCOUNTS_MAX } from '@oppenheimer/shared/schemas/telegram';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectTelegramBotDialog } from '@/features/telegram/dialogs/connect-telegram-bot';
import { telegramHostsOf } from '@/features/telegram/lib/telegram-hosts';
import { TelegramAccountRow } from '@/features/telegram/sections/telegram-account-row';
import { TelegramAnsweringRow } from '@/features/telegram/sections/telegram-answering-row';

/**
 * The reader's connected bots, one row each with who answers them there
 * under it, and Connect a bot up to three,
 * over a callout on what a bot hears in groups (privacy mode). With none yet,
 * the card that says what connecting gives the bots; with no host paired,
 * Connect is off with that as its reason. Read under Suspense, in the
 * screen's `QueryState`; a refetch that fails keeps the rows and says so.
 */
export function TelegramAccounts() {
  const { t } = useTranslation();
  const { accounts, hosts, bots, error } = useSuspenseTelegramSettings();
  const [connecting, setConnecting] = useState(false);
  const choices = telegramHostsOf(hosts);
  const atLimit = accounts.length >= TELEGRAM_ACCOUNTS_MAX;
  const noHosts = choices.length === 0;

  const connect = (
    <Button
      variant={accounts.length === 0 ? 'primary' : 'secondary'}
      size="sm"
      disabled={atLimit || noHosts}
      title={
        atLimit
          ? t('settings.telegram.atLimit', { count: TELEGRAM_ACCOUNTS_MAX })
          : noHosts
            ? t('settings.telegram.noHosts')
            : undefined
      }
      onClick={() => setConnecting(true)}
    >
      {t(accounts.length === 0 ? 'settings.telegram.connect' : 'settings.telegram.connectAnother')}
    </Button>
  );

  return (
    <>
      <Callout className="mb-4">{t('settings.telegram.privacy')}</Callout>
      <ErrorAlert error={error} fallback={t('settings.telegram.loadFailed')} />
      {accounts.length === 0 ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Send />
            </EmptyState.Media>
            <EmptyState.Title>{t('settings.telegram.emptyTitle')}</EmptyState.Title>
            <EmptyState.Description>
              {noHosts ? t('settings.telegram.noHosts') : t('settings.telegram.emptyDescription')}
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>{connect}</EmptyState.Content>
        </EmptyState>
      ) : (
        <>
          <SettingsGroup>
            {accounts.map((account) => (
              <Fragment key={account.id}>
                <TelegramAccountRow account={account} hosts={choices} />
                <TelegramAnsweringRow account={account} bots={bots} />
              </Fragment>
            ))}
          </SettingsGroup>
          <div className="mt-4 flex justify-end">{connect}</div>
        </>
      )}
      {connecting ? (
        <ConnectTelegramBotDialog hosts={choices} onClose={() => setConnecting(false)} />
      ) : null}
    </>
  );
}
