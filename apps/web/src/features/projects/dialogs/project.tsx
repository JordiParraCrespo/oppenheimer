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
 * New project and Project settings (`product/versions/mvp/05-screens.md`, the
 * 2026-09-27 export), opened from the project chip, the sidebar's plus and a
 * project header's cog. Delete project is off while the project holds
 * unresolved sessions, because the API refuses exactly that.
 *
 * Without `projectId` it creates. The project is read here rather than handed
 * in because neither opener (the sidebar, the composer) holds the rows.
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
