import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-mobile/dialog';
import type { AdminUserEntity, RoleEntity } from '@oppenheimer/frontend-admin';
import { useAssignAdminUserRoles } from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { AssignRolesForm } from '../forms/assign-roles-form';

export function AssignRolesDialog({
  user,
  roles,
  assigned,
  onClose,
}: {
  user: AdminUserEntity;
  roles: RoleEntity[];
  assigned: RoleEntity[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const assign = useAssignAdminUserRoles();
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('control.users.roles.title')}</DialogTitle>
          <DialogDescription>
            {t('control.users.roles.description', { name: user.name })}
          </DialogDescription>
        </DialogHeader>
        <AssignRolesForm
          roles={roles}
          assigned={assigned}
          onSubmit={async ({ roleIds }) => {
            try {
              await assign.mutateAsync({ userId: user.id, roleIds });
              onClose();
            } catch {
              /* Request error is shown below. */
            }
          }}
          onCancel={onClose}
          isPending={assign.isPending}
          error={assign.error}
        />
      </DialogContent>
    </Dialog>
  );
}
