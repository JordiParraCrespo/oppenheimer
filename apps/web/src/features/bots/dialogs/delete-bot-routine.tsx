import { useDeleteBotRoutine } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Delete a routine: its triggers stop and it runs no more; its past runs are kept. */
export function DeleteBotRoutineDialog({
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
  const remove = useDeleteBotRoutine({ onSuccess: onClose });

  return (
    <ConfirmDialog
      title={t('bots.settings.routines.deleteTitle', { name })}
      description={t('bots.settings.routines.deleteBody')}
      confirmLabel={t('bots.settings.routines.delete')}
      pendingLabel={t('bots.settings.routines.deleting')}
      pending={remove.isPending}
      error={remove.error}
      errorFallback={t('bots.settings.routines.deleteFailed')}
      onClose={onClose}
      onConfirm={() => remove.mutate({ id: botId, routineId })}
    />
  );
}
