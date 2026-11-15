import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useArchiveProject } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert, notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Delete the projects picked on Projects, one archive each, side by side;
 * each leaves the grid as a single delete's does. When some fail, the dialog
 * stays with them: `onLeft` hands the grid the ones still picked, the first
 * failure says why, and Delete tries them again. Their sessions stay where
 * they are, as with one project's delete.
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
  const [left, setLeft] = useState(projects);
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const archive = useArchiveProject();

  async function confirm() {
    setPending(true);
    const results = await Promise.allSettled(
      left.map((project) => archive.mutateAsync(project.id)),
    );
    setPending(false);
    const failed = left.filter((_, index) => results[index]?.status === 'rejected');
    const deleted = left.filter((_, index) => results[index]?.status === 'fulfilled');
    const [only] = deleted;
    if (deleted.length === 1 && only) notifySuccess('projectDeleted', { name: only.name });
    else if (deleted.length > 1) notifySuccess('projectsDeleted', { n: String(deleted.length) });
    onLeft(failed.map((project) => project.id));
    if (failed.length === 0) {
      onClose();
      return;
    }
    const first = results.find((result) => result.status === 'rejected');
    setFailure(first?.status === 'rejected' ? first.reason : null);
    setLeft(failed);
  }

  return (
    <ConfirmDialog
      title={t('projects.deleteProjects.title', { count: left.length })}
      description={t('projects.deleteProjects.description')}
      confirmLabel={t('projects.deleteProjects.confirm', { count: left.length })}
      pendingLabel={t('projects.deleteDialog.deleting')}
      pending={pending}
      onClose={onClose}
      onConfirm={() => void confirm()}
    >
      {failure ? (
        <ErrorAlert
          title={t('projects.deleteProjects.partial', { count: left.length })}
          error={failure}
          fallback={t('projects.deleteDialog.failed')}
        />
      ) : null}
    </ConfirmDialog>
  );
}
