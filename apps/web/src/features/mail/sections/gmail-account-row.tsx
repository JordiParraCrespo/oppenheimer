import { Button, SettingsListRow } from '@oppenheimer/design-system-web';
import type { GmailConnectionEntity } from '@oppenheimer/frontend-consumer';
import { useStartGmailConnection } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DisconnectGmailAccountDialog } from '@/features/mail/dialogs/disconnect-gmail-account';
import { RenameGmailAccountDialog } from '@/features/mail/dialogs/rename-gmail-account';

/**
 * One Gmail account: its name over its address, whether bots can reach it,
 * and Rename, Reconnect (when Google dropped the grant) and Disconnect. The
 * row owns whether a dialog is open; each dialog owns its own write.
 */
export function GmailAccountRow({ connection }: { connection: GmailConnectionEntity }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'rename' | 'disconnect' | null>(null);
  const reconnect = useStartGmailConnection();

  return (
    <>
      <SettingsListRow
        align="center"
        data-testid="gmail-account"
        meta={connection.accountEmail}
        kind={t(
          connection.needsReconnect ? 'settings.mail.needsReconnect' : 'settings.mail.connected',
        )}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen('rename')}>
              {t('settings.mail.rename')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('settings.mail.disconnectLabel', { email: connection.accountEmail })}
              onClick={() => setOpen('disconnect')}
            >
              {t('settings.mail.disconnect')}
            </Button>
            {connection.needsReconnect ? (
              <Button
                size="sm"
                variant="secondary"
                pending={reconnect.isPending}
                onClick={() => reconnect.mutate(connection.id)}
              >
                {t('settings.mail.reconnect')}
              </Button>
            ) : null}
          </>
        }
      >
        {connection.label}
      </SettingsListRow>
      <ErrorAlert
        error={reconnect.error}
        fallback={t('settings.mail.startFailed')}
        onDismiss={reconnect.reset}
      />
      {open === 'rename' ? (
        <RenameGmailAccountDialog connection={connection} onClose={() => setOpen(null)} />
      ) : null}
      {open === 'disconnect' ? (
        <DisconnectGmailAccountDialog connection={connection} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
