import type { GmailConnectionEntity } from '@oppenheimer/frontend-consumer';
import { useDisconnectGmail } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Disconnecting revokes the grant at Google: no bot reaches the account again until it is connected anew. */
export function DisconnectGmailAccountDialog({
  connection,
  onClose,
}: {
  connection: GmailConnectionEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const disconnect = useDisconnectGmail({ onSuccess: onClose });
  return (
    <ConfirmDialog
      title={t('settings.mail.disconnectTitle', { email: connection.accountEmail })}
      description={t('settings.mail.disconnectDescription')}
      confirmLabel={t('settings.mail.disconnect')}
      pendingLabel={t('settings.mail.disconnecting')}
      pending={disconnect.isPending}
      error={disconnect.error}
      errorFallback={t('settings.mail.disconnectFailed')}
      onClose={onClose}
      onConfirm={() => disconnect.mutate(connection.id)}
    />
  );
}
