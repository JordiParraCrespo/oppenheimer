import { useDeleteAccount } from '@oppenheimer/frontend-consumer/react';
import { useLogout } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { DeleteAccountForm } from '../forms/delete-account-form';

const FORM_ID = 'delete-account';

/**
 * Delete account, confirmed by typing the email; the destructive button
 * submits the form so the email is checked before anything is sent. After the
 * delete there is no account left, so the dialog signs out (clearing the
 * cookie and the query cache) and lands on sign-in whether or not the sign-out
 * answered, locked from the delete until then.
 */
export function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout({
    onSettled: () => navigate({ to: '/login', replace: true }),
  });
  const remove = useDeleteAccount({ onSuccess: () => logout.mutate() });
  const pending = remove.isPending || remove.isSuccess;

  return (
    <ConfirmDialog
      title={t('settings.deleteAccount.title')}
      description={t('settings.deleteAccount.description')}
      confirmLabel={t('settings.deleteAccount.confirm')}
      pendingLabel={t('settings.deleteAccount.deleting')}
      pending={pending}
      error={remove.error}
      errorFallback={t('settings.deleteAccount.failed')}
      onClose={onClose}
      form={FORM_ID}
    >
      <DeleteAccountForm
        id={FORM_ID}
        email={email}
        isPending={pending}
        onSubmit={(dto) => remove.mutate(dto)}
      />
    </ConfirmDialog>
  );
}
