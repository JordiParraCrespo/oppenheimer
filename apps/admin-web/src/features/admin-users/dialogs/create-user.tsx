import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { UserPlus } from '@oppenheimer/design-system-web/icons';
import { useCreateAdminUser } from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { CreateUserForm } from '@/features/admin-users/forms/create-user-form';

export function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateAdminUser();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHero gradient="tealGreen">
          <DialogHeroPlate>
            <UserPlus />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('control.users.create.title')}</DialogTitle>
          <DialogDescription>{t('control.users.create.description')}</DialogDescription>
        </DialogHeader>
        <CreateUserForm
          isPending={create.isPending}
          error={create.error}
          onCancel={onClose}
          onSubmit={async (values) => {
            try {
              await create.mutateAsync({
                ...values,
                password: values.password || undefined,
                role: 'user',
              });
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
