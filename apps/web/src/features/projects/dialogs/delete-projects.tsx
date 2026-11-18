import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useArchiveProject } from '@oppenheimer/frontend-consumer/react';
import { BulkConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Delete the projects picked on Projects, one archive each, side by side;
 * each leaves the grid as a single delete's does. When some fail, the dialog
 * stays with them and Delete tries them again (`BulkConfirmDialog`). Their
 * sessions stay where they are, as with one project's delete.
 */
export function DeleteProjectsDialog({
  projects,
  onLeft,
  onClose,
}: {
  projects: ProjectEntity[];
  /** The projects a delete failed on, to keep picked; empty once all are gone. */
  onLeft: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const archive = useArchiveProject();

  return (
    <BulkConfirmDialog
      items={projects}
      keyOf={(project) => project.id}
      run={(project) => archive.mutateAsync(project.id)}
      title={(count) => t('projects.deleteProjects.title', { count })}
      description={t('projects.deleteProjects.description')}
      confirmLabel={(count) => t('projects.deleteProjects.confirm', { count })}
      pendingLabel={t('projects.deleteDialog.deleting')}
      partial={(count) => t('projects.deleteProjects.partial', { count })}
      errorFallback={t('projects.deleteDialog.failed')}
      onDone={([only, ...rest]) =>
        only && rest.length === 0
          ? notifySuccess('projectDeleted', { name: only.name })
          : notifySuccess('projectsDeleted', { n: String(rest.length + 1) })
      }
      onLeft={onLeft}
      onClose={onClose}
    />
  );
}
