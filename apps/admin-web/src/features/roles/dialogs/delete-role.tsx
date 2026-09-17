import type { RoleEntity } from '@oppenheimer/frontend-admin';
import { useDeleteRole } from '@oppenheimer/frontend-admin/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

export function DeleteRoleDialog({ role, onClose }: { role: RoleEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useDeleteRole();
  return (
    <ConfirmDialog
      title={t('pages.team.confirm.deleteRoleTitle')}
      description={t('pages.team.confirm.deleteRoleDescription')}
      pending={remove.isPending}
      error={remove.error}
      onClose={onClose}
      onConfirm={() => remove.mutate(role.id, { onSuccess: onClose })}
    />
  );
}
