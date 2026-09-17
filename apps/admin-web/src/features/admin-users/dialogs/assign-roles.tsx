import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { Shield } from '@oppenheimer/design-system-web/icons';
import type { AdminUserEntity, RoleEntity } from '@oppenheimer/frontend-admin';
import { useAssignAdminUserRoles } from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { AssignRolesForm } from '@/features/admin-users/forms/assign-roles-form';

export function AssignRolesDialog({
  user,
  roles,
  assignedRoles,
  onClose,
}: {
  user: AdminUserEntity;
  roles: RoleEntity[];
  assignedRoles: RoleEntity[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const assign = useAssignAdminUserRoles();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHero gradient="tealGreen">
          <DialogHeroPlate>
            <Shield />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('control.users.roles.title')}</DialogTitle>
          <DialogDescription>
            {t('control.users.roles.description', { name: user.name })}
          </DialogDescription>
        </DialogHeader>
        <AssignRolesForm
          roles={roles}
          assignedRoles={assignedRoles}
          isPending={assign.isPending}
          error={assign.error}
          onCancel={onClose}
          onSubmit={async ({ roleIds }) => {
            try {
              await assign.mutateAsync({ userId: user.id, roleIds });
              onClose();
            } catch {
              // The request error stays visible in the dialog.
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
