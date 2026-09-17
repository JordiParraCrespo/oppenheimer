import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useBanAdminUser } from '@oppenheimer/frontend-admin/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

export function BanUserDialog({ user, onClose }: { user: AdminUserEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const mutation = useBanAdminUser();

  return (
    <ConfirmDialog
      title={t('control.users.confirm.ban.title')}
      description={t('control.users.confirm.ban.description', { name: user.name })}
      confirmLabel={t('control.users.confirm.ban.submit')}
      pending={mutation.isPending}
      error={mutation.error}
      onClose={onClose}
      onConfirm={() => mutation.mutate({ id: user.id }, { onSuccess: onClose })}
    />
  );
}
