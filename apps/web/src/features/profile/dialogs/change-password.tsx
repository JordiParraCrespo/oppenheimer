import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useChangeOwnPassword } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ChangePasswordForm } from '../forms/change-password-form';

/**
 * Change password. Every other device is signed out with it — the usual
 * reason to change a password is that someone else may know the old one —
 * and the device list below refreshes on its own. A wrong current password
 * is the API's answer and stays next to the form.
 */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const change = useChangeOwnPassword({
    onSuccess: () => {
      notifySuccess('passwordChanged');
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-105">
        <DialogHeader>
          <DialogTitle>{t('settings.changePassword.title')}</DialogTitle>
          <DialogDescription>{t('settings.changePassword.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={change.error} fallback={t('settings.changePassword.failed')} />
            <ChangePasswordForm
              isPending={change.isPending}
              onSubmit={({ currentPassword, newPassword }) =>
                change.mutate({ currentPassword, newPassword, revokeOtherSessions: true })
              }
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
