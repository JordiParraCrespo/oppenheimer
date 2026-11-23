import { useRevokeBotRoutineWebhook } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Revoke a routine's webhook URL: posts to it are refused; the routine keeps its webhook trigger. */
export function RevokeRoutineWebhookDialog({
  botId,
  routineId,
  name,
  onClose,
}: {
  botId: string;
  routineId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const revoke = useRevokeBotRoutineWebhook({ onSuccess: onClose });

  return (
    <ConfirmDialog
      title={t('bots.settings.routines.webhookUrl.revokeTitle', { name })}
      description={t('bots.settings.routines.webhookUrl.revokeBody')}
      confirmLabel={t('bots.settings.routines.webhookUrl.revoke')}
      pendingLabel={t('bots.settings.routines.webhookUrl.revoking')}
      pending={revoke.isPending}
      error={revoke.error}
      errorFallback={t('bots.settings.routines.webhookUrl.revokeFailed')}
      onClose={onClose}
      onConfirm={() => revoke.mutate({ id: botId, routineId })}
    />
  );
}
