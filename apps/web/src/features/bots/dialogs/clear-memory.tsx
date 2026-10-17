import { useClearBotMemory } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Clear all: the bot forgets every fact; its soul and instructions stay. */
export function ClearMemoryDialog({
  botId,
  count,
  onClose,
}: {
  botId: string;
  count: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const clear = useClearBotMemory({ onSuccess: onClose });

  return (
    <ConfirmDialog
      title={t('bots.settings.memory.clearTitle', { count })}
      description={t('bots.settings.memory.clearBody')}
      confirmLabel={t('bots.settings.memory.clearAll')}
      pendingLabel={t('bots.settings.memory.clearing')}
      pending={clear.isPending}
      error={clear.error}
      errorFallback={t('bots.settings.memory.clearFailed')}
      onClose={onClose}
      onConfirm={() => clear.mutate(botId)}
    />
  );
}
