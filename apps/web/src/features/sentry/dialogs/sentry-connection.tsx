import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useConnectSentry } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { SentryConnectionForm } from '../forms/sentry-connection-form';

/**
 * Connect the workspace's Sentry organization, or replace its secret. The
 * webhook URL to paste into Sentry is on the settings row once it is saved.
 */
export function SentryConnectionDialog({
  organizationSlug,
  onClose,
}: {
  organizationSlug: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const connect = useConnectSentry({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('settings.sentry.dialog.title')}</DialogTitle>
          <DialogDescription>{t('settings.sentry.dialog.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={connect.error} fallback={t('settings.sentry.dialog.failed')} />
            <SentryConnectionForm
              organizationSlug={organizationSlug}
              isPending={connect.isPending}
              onSubmit={(values) => connect.mutate(values)}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
