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
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useAssignAdminUserRoles, useRoles, useUserRoles } from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { AssignRolesForm } from '@/features/admin-users/forms/assign-roles-form';

/**
 * Assign a user's roles.
 *
 * Both lists are asked for here, when the dialog opens, rather than kept warm
 * by the table behind it: nothing else on that screen renders the catalog, and
 * the reader's current roles are already cached under the same key the row's
 * pills used, so this costs a lookup rather than a request.
 */
export function AssignRolesDialog({
  user,
  onClose,
}: {
  user: AdminUserEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const roles = useRoles({ page: 1, limit: 100 });
  const assignedRoles = useUserRoles(user.id);
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
          roles={roles.data?.data ?? []}
          assignedRoles={assignedRoles.data ?? []}
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
