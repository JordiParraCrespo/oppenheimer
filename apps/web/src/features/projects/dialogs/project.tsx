import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FieldDescription,
  Skeleton,
} from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ProjectEditorDialog } from './project-editor';

/**
 * New project, and Project settings: the dialog over the console behind the
 * project chip's foot row, the sidebar's plus and a project header's cog
 * (`product/versions/mvp/05-screens.md`, the 2026-09-27 export).
 *
 * A 540px dialog: the name; Repositories as a field that adds one at a time
 * from the App's list, the added ones listed under it with an X; then a
 * Defaults fold, optional, that reads what is set while closed — the host as
 * chips, the agent as chips, and Cloned by default, a checkbox per added
 * repository with its base-branch pill. Save is off until the project is
 * whole: a name, a repository, one of them cloned by default. Editing puts
 * Delete project on the footer's left, off while the project holds
 * unresolved sessions, because the API refuses exactly that.
 *
 * `projectId` says which project it edits; absent, it creates. The project
 * is read here rather than handed in, because the sidebar and the composer
 * both open it and neither holds the rows. What leaves is the created or
 * saved project, for the surface that asked.
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
  const projects = useProjects();
  const project = projectId ? projects.data?.find((row) => row.id === projectId) : undefined;

  if (projectId && !project) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="form" closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('projects.dialog.editTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="pb-7">
              {projects.isPending ? (
                <Skeleton className="h-30 w-full" />
              ) : projects.isError ? (
                // A failed read is not a deleted project.
                <ErrorAlert error={projects.error} fallback={t('projects.dialog.loadFailed')} />
              ) : (
                <FieldDescription>{t('projects.dialog.gone')}</FieldDescription>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ProjectEditorDialog
      key={project?.id ?? 'new'}
      project={project}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
