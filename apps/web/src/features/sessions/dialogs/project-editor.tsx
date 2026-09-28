import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  type RepositoryRowValue,
} from '@oppenheimer/design-system-web';
import { type ProjectEntity, repositoryKey } from '@oppenheimer/frontend-consumer';
import { useCreateProject, useUpdateProject } from '@oppenheimer/frontend-consumer/react';
import { lastFailure, useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  ErrorAlert,
  notifySuccess,
  useServerFieldErrors,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProjectSaveButton } from '../components/project-save-button';
import { ProjectForm } from '../forms/project-form';
import { type ProjectFormValues, projectBlock, projectFormSchema } from '../lib/project-draft';
import { toProjectRepositoryInputs } from '../lib/project-rows';
import { ProjectClonedField } from '../sections/project-cloned-field';
import { ProjectDefaultsSummary } from '../sections/project-defaults-summary';
import { ProjectDeleteButton } from '../sections/project-delete-button';
import { ProjectHostField } from '../sections/project-host-field';
import { ProjectRepositoriesField } from '../sections/project-repositories-field';
import { DeleteProjectDialog } from './delete-project';

/** A project's rows as the list holds them: its repositories, with their bases. */
function rowsOf(project: ProjectEntity | undefined): RepositoryRowValue[] {
  return (project?.repositories ?? []).map((repository) => ({
    id: repositoryKey({
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
    }),
    isDefault: repository.isDefault,
    branch: repository.baseBranch,
  }));
}

/**
 * The project dialog once the project it edits is known (`ProjectDialog`
 * reads it, and keys this so a different project is a fresh form rather than
 * one reset by an effect).
 *
 * It owns the two writes and the form's store, and reads no field: the name
 * is watched by Save, the rows by the pickers that bind them, the defaults by
 * the fold's summary, so a keystroke or a pick renders the part that shows it
 * and not this dialog. Editing puts Delete project on the footer's left, and
 * Delete closes this dialog into the confirm.
 */
export function ProjectEditorDialog({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectEntity | undefined;
  onClose: () => void;
  onSaved: (project: ProjectEntity) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const editing = project !== undefined;
  // The workspace's Unassigned project: its name is fixed and it cannot be
  // deleted (`PROJECTS_008`); its repositories and defaults edit like any other.
  const fixed = project?.isUnassigned === true;
  const [deleting, setDeleting] = useState(false);

  // The dialog closes on a save, and what it saved is a group in the sidebar
  // or a chip on New session, so the save says so.
  const create = useCreateProject({
    onSuccess: (saved) => {
      notifySuccess('projectCreated', { name: saved.name });
      onSaved(saved);
    },
  });
  const update = useUpdateProject({
    onSuccess: (saved) => {
      notifySuccess('projectSaved', { name: saved.name });
      onSaved(saved);
    },
  });
  const pending = create.isPending || update.isPending;
  const saveFailure = lastFailure([create, update]).error;
  const saveFallback = t(editing ? 'projects.dialog.saveFailed' : 'projects.dialog.failed');
  const failure = saveFailure ? resolveError(saveFailure, saveFallback) : null;

  const form = useForm<ProjectFormValues>({
    resolver: useZodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name ?? '',
      rows: rowsOf(project),
      defaultHostId: project?.defaultHostId ?? null,
      defaultAgent: project?.defaultAgent ?? null,
    },
  });
  // A name the server refused is marked on the name field itself, and the
  // alert stays only for what the fields cannot say.
  const { showAlert } = useServerFieldErrors(form, failure);

  function submit(values: ProjectFormValues) {
    if (projectBlock(values.name, values, { holdsNone: fixed })) return;
    const repositories = toProjectRepositoryInputs(values.rows);
    const input = {
      // Unassigned keeps its name, so the name is not sent for it.
      ...(fixed ? {} : { name: values.name.trim() }),
      // Unassigned with no repository leaves the list as it is: the API holds a
      // project's repositories to at least one whenever they are sent.
      ...(fixed && repositories.length === 0 ? {} : { repositories }),
      defaultHostId: values.defaultHostId,
      defaultAgent: values.defaultAgent,
    };
    if (project) update.mutate({ id: project.id, input });
    else create.mutate({ ...input, name: values.name.trim(), repositories });
  }

  // Delete project closes this dialog into the confirm: one modal at a time.
  // The form's store stays with this component, so Cancel on the confirm
  // brings the dialog back with everything typed still there.
  if (project && deleting) {
    return (
      <DeleteProjectDialog
        project={project}
        onClose={() => setDeleting(false)}
        onDeleted={onClose}
      />
    );
  }

  return (
    // A save in flight keeps the dialog: its success picks or navigates
    // through the caller, and a dialog dismissed under it would do that to a
    // person who had walked away from it.
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {editing ? t('projects.dialog.editTitle') : t('projects.dialog.newTitle')}
          </DialogTitle>
        </DialogHeader>
        <ProjectForm
          form={form}
          fixed={fixed}
          pending={pending}
          alert={<ErrorAlert error={showAlert ? saveFailure : null} fallback={saveFallback} />}
          repositories={<ProjectRepositoriesField control={form.control} />}
          host={<ProjectHostField control={form.control} />}
          cloned={<ProjectClonedField control={form.control} />}
          summary={<ProjectDefaultsSummary control={form.control} />}
          onSubmit={submit}
          footer={
            <>
              {project && !fixed ? (
                <>
                  <ProjectDeleteButton
                    project={project}
                    disabled={pending}
                    onDelete={() => setDeleting(true)}
                  />
                  <span className="flex-1" />
                </>
              ) : null}
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                {t('common.cancel')}
              </Button>
              <ProjectSaveButton
                control={form.control}
                editing={editing}
                fixed={fixed}
                pending={pending}
              />
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
