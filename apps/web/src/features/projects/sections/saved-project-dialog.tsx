import { FieldDescription } from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseProjects } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ProjectDialogShell } from '../components/project-dialog-shell';
import { ProjectEditorDialog } from '../dialogs/project-editor';

/**
 * Project settings, in `ProjectDialog`'s `QueryState.Data`: the project read
 * under Suspense, then its editor; a project that is gone says so. A refetch
 * that fails keeps the editor and says so in the frame it would otherwise
 * show.
 */
export function SavedProjectDialog({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: (project: ProjectEntity) => void;
}) {
  const { t } = useTranslation();
  const { data: project, error } = useSuspenseProjects(
    (rows) => rows.find((row) => row.id === projectId) ?? null,
  );

  if (!project)
    return (
      <ProjectDialogShell onClose={onClose}>
        <ErrorAlert error={error} fallback={t('projects.dialog.loadFailed')} />
        <FieldDescription>{t('projects.dialog.gone')}</FieldDescription>
      </ProjectDialogShell>
    );
  return (
    <ProjectEditorDialog key={project.id} project={project} onClose={onClose} onSaved={onSaved} />
  );
}
