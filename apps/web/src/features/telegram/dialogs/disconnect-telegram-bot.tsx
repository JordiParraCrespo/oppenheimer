import type { TelegramAccountEntity } from '@oppenheimer/frontend-consumer';
import { useUnlinkTelegram } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Disconnecting makes the host forget the token: no bot of the reader's reaches it again. */
export function DisconnectTelegramBotDialog({
  account,
  onClose,
}: {
  account: TelegramAccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const unlink = useUnlinkTelegram({ onSuccess: onClose });
  return (
    <ConfirmDialog
      title={t('settings.telegram.disconnectTitle', { label: account.label })}
      description={t('settings.telegram.disconnectDescription')}
      confirmLabel={t('settings.telegram.disconnect')}
      pendingLabel={t('settings.telegram.disconnecting')}
      pending={unlink.isPending}
      error={unlink.error}
      errorFallback={t('settings.telegram.disconnectFailed')}
      onClose={onClose}
      onConfirm={() => unlink.mutate(account.id)}
    />
  );
}
