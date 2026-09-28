import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useArchiveProject } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Delete a project, from the foot of the Project settings dialog.
 *
 * "Delete" is the console's word for the API's archive: the row is kept so
 * its slug is never reissued, and the list stops showing it. The confirm is
 * the inventory's (`design/version1/Components.dc.html`): the title names the
 * thing, the body states the cost, the primary is the verb.
 */
export function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: ProjectEntity;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const archive = useArchiveProject({
    onSuccess: () => {
      notifySuccess(t('toasts.projectDeleted', { name: project.name }));
      onDeleted();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('projects.deleteDialog.title', { name: project.name })}</DialogTitle>
          <DialogDescription>{t('projects.deleteDialog.description')}</DialogDescription>
        </DialogHeader>
        {archive.isError ? (
          <div className="px-7">
            <Alert variant="destructive">
              <AlertDescription>
                {resolveError(archive.error, t('projects.deleteDialog.failed')).message}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={archive.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={archive.isPending}
            onClick={() => archive.mutate(project.id)}
          >
            {archive.isPending
              ? t('projects.deleteDialog.deleting')
              : t('projects.deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
