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
import type { RoleEntity } from '@oppenheimer/frontend-admin';
import {
  useAuthorizationCatalog,
  useCreateRole,
  useUpdateRole,
} from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { RoleForm } from '@/features/roles/forms/role-form';

export function RoleEditorDialog({
  role,
  sourceRole,
  onClose,
}: {
  role?: RoleEntity;
  sourceRole?: RoleEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const catalog = useAuthorizationCatalog();
  const create = useCreateRole();
  const update = useUpdateRole();
  const error = create.error ?? update.error;
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHero gradient="tealGreen">
          <DialogHeroPlate>
            <Shield />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>
            {t(role ? 'pages.team.roleForm.editTitle' : 'pages.team.roleForm.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('pages.team.roleForm.description')}</DialogDescription>
        </DialogHeader>
        <RoleForm
          role={role}
          sourceRole={sourceRole}
          catalog={catalog.data}
          catalogLoading={catalog.isLoading}
          isPending={pending}
          error={error}
          onCancel={onClose}
          onSubmit={async (values) => {
            try {
              if (role) {
                await update.mutateAsync({
                  id: role.id,
                  dto: {
                    description: values.description,
                    permissions: values.permissions,
                  },
                });
              } else {
                await create.mutateAsync({
                  name: values.name,
                  description: values.description,
                  permissions: values.permissions,
                });
              }
              onClose();
            } catch {
              // Mutation errors are rendered in the dialog so the user can retry.
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
