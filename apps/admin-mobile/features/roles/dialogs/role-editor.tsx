import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-mobile/dialog';
import type { RoleEntity } from '@oppenheimer/frontend-admin';
import {
  useAuthorizationCatalog,
  useCreateRole,
  useUpdateRole,
} from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { RoleForm } from '../forms/role-form';

export function RoleEditorDialog({ role, onClose }: { role?: RoleEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateRole();
  const update = useUpdateRole();
  const catalog = useAuthorizationCatalog();
  const error = create.error ?? update.error;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(role ? 'pages.team.roleForm.editTitle' : 'pages.team.roleForm.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('pages.team.roleForm.description')}</DialogDescription>
        </DialogHeader>
        <RoleForm
          role={role}
          grantable={catalog.data?.grantable}
          onSubmit={async (values) => {
            try {
              if (role) {
                await update.mutateAsync({
                  id: role.id,
                  dto: { description: values.description, permissions: values.permissions },
                });
              } else {
                await create.mutateAsync(values);
              }
              onClose();
            } catch {
              // The request error stays visible in the dialog.
            }
          }}
          onCancel={onClose}
          isPending={create.isPending || update.isPending}
          error={error}
        />
      </DialogContent>
    </Dialog>
  );
}
