import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useLinkTelegram } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ConnectTelegramForm } from '@/features/telegram/forms/connect-telegram-form';
import type { TelegramHost } from '@/features/telegram/lib/telegram-hosts';

/**
 * Connect a bot: how to get its token from @BotFather, then the host that
 * polls it and the token. Given `reconnect`, it hands the bot already on that
 * host a new token (after it was revoked) and keeps its chats.
 */
export function ConnectTelegramBotDialog({
  hosts,
  reconnect,
  onClose,
}: {
  hosts: readonly TelegramHost[];
  reconnect?: { hostId: string; label: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const link = useLinkTelegram({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {reconnect
              ? t('settings.telegram.reconnectTitle', { label: reconnect.label })
              : t('settings.telegram.connectTitle')}
          </DialogTitle>
          <DialogDescription>
            {reconnect
              ? t('settings.telegram.reconnectDescription')
              : t('settings.telegram.connectDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('settings.telegram.step1')}</li>
              <li>{t('settings.telegram.step2')}</li>
              <li>{t('settings.telegram.step3')}</li>
            </ol>
            <ErrorAlert error={link.error} fallback={t('settings.telegram.connectFailed')} />
            <ConnectTelegramForm
              hosts={hosts}
              fixedHostId={reconnect?.hostId}
              defaultLabel={reconnect?.label}
              isPending={link.isPending}
              onSubmit={({ hostId, token, label }) =>
                link.mutate({ hostId, token, label: label || undefined })
              }
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
