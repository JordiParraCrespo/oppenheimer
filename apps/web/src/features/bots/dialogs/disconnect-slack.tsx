import type { SlackAccountEntity } from '@oppenheimer/frontend-consumer';
import { useDisconnectSlack } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Disconnecting forgets the app's token: the bot stops answering in Slack, and the app stays there. */
export function DisconnectSlackDialog({
  account,
  onClose,
}: {
  account: SlackAccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const disconnect = useDisconnectSlack({ onSuccess: onClose });
  return (
    <ConfirmDialog
      title={t('bots.settings.slack.disconnectTitle', { name: account.botName })}
      description={t('bots.settings.slack.disconnectDescription')}
      confirmLabel={t('bots.settings.slack.disconnect')}
      pendingLabel={t('bots.settings.slack.disconnecting')}
      pending={disconnect.isPending}
      error={disconnect.error}
      errorFallback={t('bots.settings.slack.disconnectFailed')}
      onClose={onClose}
      onConfirm={() => disconnect.mutate(account.id)}
    />
  );
}
