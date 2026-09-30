import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
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
import { ProjectAgentField } from '../components/project-agent-field';
import { ProjectNameField } from '../components/project-name-field';
import { ProjectSaveButton } from '../components/project-save-button';
import {
  type ProjectFormValues,
  projectBlock,
  projectDraftOf,
  projectFormSchema,
  projectInputOf,
} from '../lib/project-draft';
import { ProjectClonedField } from '../sections/project-cloned-field';
import { ProjectDefaultsSummary } from '../sections/project-defaults-summary';
import { ProjectDeleteButton } from '../sections/project-delete-button';
import { ProjectHostField } from '../sections/project-host-field';
import { ProjectRepositoriesField } from '../sections/project-repositories-field';
import { DeleteProjectDialog } from './delete-project';

/**
 * New project and Project settings once the project is known; `ProjectDialog`
 * keys this per project so another project is a fresh form, not an effect
 * reset. It owns the two writes and the form's store and reads no field: each
 * field binds its own value (a section when it lists API data, a component
 * when it reads only the form), so a keystroke or a pick renders the part that
 * shows it and not the dialog.
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
    defaultValues: projectDraftOf(project),
  });
  const { control } = form;
  // A name the server refused is marked on the name field itself, and the
  // alert stays only for what the fields cannot say.
  const { showAlert } = useServerFieldErrors(form, failure);

  function submit(values: ProjectFormValues) {
    if (projectBlock(values.name, values.rows, { holdsNone: fixed })) return;
    const input = projectInputOf(values, { fixed });
    if (project) update.mutate({ id: project.id, input });
    else
      create.mutate({ ...input, name: values.name.trim(), repositories: input.repositories ?? [] });
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
        <form onSubmit={form.handleSubmit(submit)} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('projects.dialog.editTitle') : t('projects.dialog.newTitle')}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col gap-5.5">
              <ErrorAlert error={showAlert ? saveFailure : null} fallback={saveFallback} />
              <ProjectNameField form={form} fixed={fixed} pending={pending} />
              <ProjectRepositoriesField control={control} />
              <Disclosure>
                <DisclosureTrigger
                  meta={t('projects.dialog.optional')}
                  summary={<ProjectDefaultsSummary control={control} />}
                >
                  {t('projects.dialog.defaults')}
                </DisclosureTrigger>
                <DisclosurePanel>
                  <div className="flex flex-col gap-4.5">
                    <p className="m-0 text-sm text-pretty text-fg-muted">
                      {t('projects.dialog.defaultsHint')}
                    </p>
                    <ProjectHostField control={control} />
                    <ProjectAgentField control={control} />
                    <ProjectClonedField control={control} />
                  </div>
                </DisclosurePanel>
              </Disclosure>
            </div>
          </DialogBody>

          <DialogFooter>
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
              control={control}
              editing={editing}
              fixed={fixed}
              pending={pending}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
