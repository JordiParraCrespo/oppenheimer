import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useArchiveProject } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Delete a project, from the foot of the Project settings dialog.
 *
 * "Delete" is the console's word for the API's archive: the row is kept so
 * its slug is never reissued, and the list stops showing it.
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
  const archive = useArchiveProject({
    onSuccess: () => {
      notifySuccess('projectDeleted', { name: project.name });
      onDeleted();
    },
  });

  return (
    <ConfirmDialog
      title={t('projects.deleteDialog.title', { name: project.name })}
      description={t('projects.deleteDialog.description')}
      confirmLabel={t('projects.deleteDialog.confirm')}
      pendingLabel={t('projects.deleteDialog.deleting')}
      pending={archive.isPending}
      error={archive.error}
      errorFallback={t('projects.deleteDialog.failed')}
      onClose={onClose}
      onConfirm={() => archive.mutate(project.id)}
    />
  );
}
