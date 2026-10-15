import { Button, FieldDescription, Skeleton } from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ProjectDialogShell } from '../components/project-dialog-shell';
import { SavedProject } from '../sections/saved-project';
import { ProjectEditorDialog } from './project-editor';

/**
 * New project and Project settings (`product/versions/mvp/05-screens.md`, the
 * 2026-09-27 export), opened from the project chip, the sidebar's plus and a
 * project header's cog.
 *
 * Without `projectId` it creates. With one, the project is read under
 * Suspense, because neither opener (the sidebar, the composer) holds the
 * rows; until it answers, the frame holds its place, and a failed read is not
 * a deleted project.
 */
export function ProjectDialog({
  projectId,
  onClose,
  onSaved,
}: {
  projectId?: string;
  onClose: () => void;
  onSaved: (project: ProjectEntity) => void;
}) {
  const { t } = useTranslation();
  if (!projectId)
    return (
      <ProjectEditorDialog key="new" project={undefined} onClose={onClose} onSaved={onSaved} />
    );

  return (
    <QueryState>
      <QueryState.Pending>
        <ProjectDialogShell onClose={onClose}>
          <Skeleton className="h-30 w-full" />
        </ProjectDialogShell>
      </QueryState.Pending>
      <QueryState.Error>
        {(error, retry) => (
          <ProjectDialogShell onClose={onClose}>
            <ErrorAlert
              error={error}
              fallback={t('projects.dialog.loadFailed')}
              action={
                <Button variant="ghost" size="sm" onClick={retry}>
                  {t('common.retry')}
                </Button>
              }
            />
          </ProjectDialogShell>
        )}
      </QueryState.Error>
      <QueryState.Data>
        <SavedProject projectId={projectId}>
          {(project) =>
            project ? (
              <ProjectEditorDialog
                key={project.id}
                project={project}
                onClose={onClose}
                onSaved={onSaved}
              />
            ) : (
              <ProjectDialogShell onClose={onClose}>
                <FieldDescription>{t('projects.dialog.gone')}</FieldDescription>
              </ProjectDialogShell>
            )
          }
        </SavedProject>
      </QueryState.Data>
    </QueryState>
  );
}
