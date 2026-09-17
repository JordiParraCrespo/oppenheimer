import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { KeyRound } from '@oppenheimer/design-system-web/icons';
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useSetAdminUserPassword } from '@oppenheimer/frontend-admin/react';
import { useTranslation } from 'react-i18next';
import { SetPasswordForm } from '@/features/admin-users/forms/set-password-form';

export function SetPasswordDialog({
  user,
  onClose,
}: {
  user: AdminUserEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const setPassword = useSetAdminUserPassword();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHero gradient="pinkCoral">
          <DialogHeroPlate>
            <KeyRound />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('control.users.password.title')}</DialogTitle>
          <DialogDescription>
            {t('control.users.password.description', { name: user.name })}
          </DialogDescription>
        </DialogHeader>
        <SetPasswordForm
          isPending={setPassword.isPending}
          error={setPassword.error}
          onCancel={onClose}
          onSubmit={async ({ newPassword }) => {
            try {
              await setPassword.mutateAsync({ id: user.id, newPassword });
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
