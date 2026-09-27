import {
  Alert,
  AlertDescription,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useDeleteAccount } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage, useLogout } from '@oppenheimer/frontend-core/react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { DeleteAccountForm } from '../forms/delete-account-form';

/**
 * Delete account: what goes with it, and the email typed out to confirm.
 *
 * Once the API has deleted it there is no account to be signed in to, so
 * the dialog signs out — which clears the cookie and every cached query —
 * and lands on sign-in whether or not that sign-out answered, since there
 * is nothing left behind it to show.
 */
export function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const navigate = useNavigate();
  const logout = useLogout({
    onSettled: () => navigate({ to: '/login', replace: true }),
  });
  const remove = useDeleteAccount({ onSuccess: () => logout.mutate() });
  const pending = remove.isPending || remove.isSuccess;

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-105">
        <DialogHeader>
          <DialogTitle>{t('settings.deleteAccount.title')}</DialogTitle>
          <DialogDescription>{t('settings.deleteAccount.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            {remove.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(remove.error, t('settings.deleteAccount.failed')).message}
                </AlertDescription>
              </Alert>
            ) : null}
            <DeleteAccountForm
              email={email}
              isPending={pending}
              onSubmit={(dto) => remove.mutate(dto)}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
