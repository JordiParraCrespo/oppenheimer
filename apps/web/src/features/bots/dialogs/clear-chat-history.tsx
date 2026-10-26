import { useClearBotConversation } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Clear history: every message of the chat is erased; the bot keeps its
 * soul, instructions and memory. While a turn works the API refuses
 * (`BOTS_022`) and the dialog says to stop it first.
 */
export function ClearChatHistoryDialog({ botId, onClose }: { botId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const clear = useClearBotConversation({ onSuccess: onClose });

  return (
    <ConfirmDialog
      title={t('bots.settings.profile.clearTitle')}
      description={t('bots.settings.profile.clearBody')}
      confirmLabel={t('bots.settings.profile.clear')}
      pendingLabel={t('bots.settings.profile.clearing')}
      pending={clear.isPending}
      error={clear.error}
      errorFallback={t('bots.settings.profile.clearFailed')}
      onClose={onClose}
      onConfirm={() => clear.mutate(botId)}
    />
  );
}
