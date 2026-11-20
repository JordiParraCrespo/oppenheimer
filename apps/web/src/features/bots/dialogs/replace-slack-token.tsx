import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { SlackAccountEntity } from '@oppenheimer/frontend-consumer';
import { useConnectSlack } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ConnectSlackForm } from '@/features/bots/forms/connect-slack-form';

/**
 * New credentials for the bot's app: after Slack refused its token (the app
 * reinstalled, the token rotated), or to move the bot to another app. Another
 * app has never met the owner, who links their Slack user again.
 */
export function ReplaceSlackTokenDialog({
  account,
  onClose,
}: {
  account: SlackAccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const connect = useConnectSlack({ onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {t('bots.settings.slack.replaceTitle', { name: account.botName })}
          </DialogTitle>
          <DialogDescription>{t('bots.settings.slack.replaceDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={connect.error} fallback={t('bots.settings.slack.connectFailed')} />
            <ConnectSlackForm
              botId={account.botId}
              isPending={connect.isPending}
              submitLabel={t('bots.settings.slack.replaceSubmit')}
              onSubmit={(values) => connect.mutate(values)}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
