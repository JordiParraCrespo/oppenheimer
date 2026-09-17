import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useUnbanAdminUser } from '@oppenheimer/frontend-admin/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

export function UnbanUserDialog({ user, onClose }: { user: AdminUserEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const mutation = useUnbanAdminUser();

  return (
    <ConfirmDialog
      title={t('control.users.confirm.unban.title')}
      description={t('control.users.confirm.unban.description', { name: user.name })}
      confirmLabel={t('control.users.confirm.unban.submit')}
      pending={mutation.isPending}
      error={mutation.error}
      onClose={onClose}
      onConfirm={() => mutation.mutate(user.id, { onSuccess: onClose })}
    />
  );
}
