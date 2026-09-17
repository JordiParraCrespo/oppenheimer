import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useDeleteAdminUser } from '@oppenheimer/frontend-admin/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

export function DeleteUserDialog({
  user,
  onClose,
}: {
  user: AdminUserEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const mutation = useDeleteAdminUser();

  return (
    <ConfirmDialog
      title={t('control.users.confirm.delete.title')}
      description={t('control.users.confirm.delete.description', { name: user.name })}
      confirmLabel={t('control.users.confirm.delete.submit')}
      pending={mutation.isPending}
      error={mutation.error}
      onClose={onClose}
      onConfirm={() => mutation.mutate(user.id, { onSuccess: onClose })}
    />
  );
}
