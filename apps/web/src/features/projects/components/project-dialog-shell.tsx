import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Project settings' frame while there is no project to edit: the read
 * failed, or the project is gone. Loading is `ProjectEditorSkeleton`'s; the
 * editor draws its own dialog once there is a project.
 */
export function ProjectDialogShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('projects.dialog.editTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-7">{children}</div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
