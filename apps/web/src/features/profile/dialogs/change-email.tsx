import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useChangeEmail } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { ChangeEmailForm } from '../forms/change-email-form';

/**
 * Change email: the new address, then a note that a link went there. The
 * account does not move until the link is followed, so the profile keeps
 * its address and nothing is refreshed here. The answer is the same whether
 * or not another account holds the address — the API does not say, and
 * neither does this dialog.
 */
export function ChangeEmailDialog({
  currentEmail,
  onClose,
}: {
  currentEmail: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const change = useChangeEmail();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-105">
        {change.isSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('settings.changeEmail.sentTitle')}</DialogTitle>
              <DialogDescription>
                {t('settings.changeEmail.sent', { email: change.variables.newEmail })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                {t('settings.changeEmail.done')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('settings.changeEmail.title')}</DialogTitle>
              <DialogDescription>
                {t('settings.changeEmail.description', { email: currentEmail })}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-4 pb-7">
                {change.isError ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {resolveError(change.error, t('settings.changeEmail.failed')).message}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <ChangeEmailForm
                  isPending={change.isPending}
                  onSubmit={(dto) =>
                    change.mutate({
                      ...dto,
                      // The screen the link returns to, which says the address moved.
                      callbackURL: `${window.location.origin}/settings/profile?emailChanged=1`,
                    })
                  }
                  onCancel={onClose}
                />
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
