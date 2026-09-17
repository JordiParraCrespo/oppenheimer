import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useRevokeAdminUserSessions } from '@oppenheimer/frontend-admin/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

export function RevokeSessionsDialog({
  user,
  onClose,
}: {
  user: AdminUserEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const mutation = useRevokeAdminUserSessions();

  return (
    <ConfirmDialog
      title={t('control.users.confirm.sessions.title')}
      description={t('control.users.confirm.sessions.description', { name: user.name })}
      confirmLabel={t('control.users.confirm.sessions.submit')}
      pending={mutation.isPending}
      error={mutation.error}
      onClose={onClose}
      onConfirm={() => mutation.mutate(user.id, { onSuccess: onClose })}
    />
  );
}
