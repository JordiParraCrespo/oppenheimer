import { Button, SettingsListRow } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import type { TelegramAccountEntity } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TelegramStatus } from '@/features/telegram/components/telegram-status';
import { ConnectTelegramBotDialog } from '@/features/telegram/dialogs/connect-telegram-bot';
import { DisconnectTelegramBotDialog } from '@/features/telegram/dialogs/disconnect-telegram-bot';
import type { TelegramHost } from '@/features/telegram/lib/telegram-hosts';

/**
 * One connected bot: its name over its `@username`, its name on Telegram and
 * its host; how it stands; Open in Telegram once its username is known,
 * Connect again with a new token once the token is gone, and Disconnect.
 * The row owns which dialog is open; each dialog owns its write.
 */
export function TelegramAccountRow({
  account,
  hosts,
}: {
  account: TelegramAccountEntity;
  hosts: readonly TelegramHost[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'reconnect' | 'disconnect' | null>(null);
  const hostName = hosts.find((host) => host.id === account.hostId)?.name ?? null;
  const meta = [
    account.username
      ? `@${account.username}`
      : account.status === 'connecting'
        ? t('settings.telegram.notCheckedYet')
        : null,
    account.displayName,
    t('settings.telegram.onHost', { host: hostName ?? t('settings.telegram.unknownHost') }),
    account.statusReason,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <SettingsListRow
        align="center"
        data-testid="telegram-account"
        meta={meta}
        kind={<TelegramStatus status={account.status} hostOnline={account.hostOnline} />}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('settings.telegram.disconnectLabel', { label: account.label })}
              onClick={() => setOpen('disconnect')}
            >
              {t('settings.telegram.disconnect')}
            </Button>
            {account.link && !account.needsToken ? (
              <Button
                size="sm"
                variant="ghost"
                nativeButton={false}
                render={<a href={account.link} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink />
                {t('settings.telegram.open')}
              </Button>
            ) : null}
            {account.needsToken && account.hostOnline ? (
              <Button size="sm" variant="secondary" onClick={() => setOpen('reconnect')}>
                {t('settings.telegram.connectAgain')}
              </Button>
            ) : null}
          </>
        }
      >
        {account.label}
      </SettingsListRow>
      {open === 'reconnect' ? (
        <ConnectTelegramBotDialog
          hosts={hosts}
          reconnect={{ hostId: account.hostId, label: account.label }}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'disconnect' ? (
        <DisconnectTelegramBotDialog account={account} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
