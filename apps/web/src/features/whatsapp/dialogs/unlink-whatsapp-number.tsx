import type { WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { useUnlinkWhatsapp } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Unlinking logs the device out and deletes its keys from the host: no bot reaches the number again. */
export function UnlinkWhatsappNumberDialog({
  account,
  onClose,
}: {
  account: WhatsappAccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const unlink = useUnlinkWhatsapp({ onSuccess: onClose });
  return (
    <ConfirmDialog
      title={t('settings.whatsapp.unlinkTitle', { label: account.label })}
      description={t('settings.whatsapp.unlinkDescription')}
      confirmLabel={t('settings.whatsapp.unlink')}
      pendingLabel={t('settings.whatsapp.unlinking')}
      pending={unlink.isPending}
      error={unlink.error}
      errorFallback={t('settings.whatsapp.unlinkFailed')}
      onClose={onClose}
      onConfirm={() => unlink.mutate(account.id)}
    />
  );
}
