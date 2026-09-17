import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-mobile/dialog';
import { useCreateAdminUser } from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { CreateUserForm } from '../forms/create-user-form';

export function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateAdminUser();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('control.users.create.title')}</DialogTitle>
          <DialogDescription>{t('control.users.create.description')}</DialogDescription>
        </DialogHeader>
        <CreateUserForm
          onSubmit={async (values) => {
            try {
              await create.mutateAsync({
                ...values,
                password: values.password || undefined,
                role: 'user',
              });
              onClose();
            } catch {
              /* Request error is shown below. */
            }
          }}
          onCancel={onClose}
          isPending={create.isPending}
          error={create.error}
        />
      </DialogContent>
    </Dialog>
  );
}
