import {
  AgentMark,
  Alert,
  AlertDescription,
  Button,
  Chip,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  RepositoryAddField,
  RepositoryRowList,
  type RepositoryRowValue,
  Skeleton,
} from '@oppenheimer/design-system-web';
import {
  type ProjectEntity,
  parseRepositoryKey,
  repositoryKey,
} from '@oppenheimer/frontend-consumer';
import {
  useCreateProject,
  useHosts,
  useInstallationRepositoriesFor,
  useInstallations,
  useProjects,
  useRepositoryBranchesFor,
  useSessions,
  useUpdateProject,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import { createProjectSchema } from '@oppenheimer/shared/schemas/project';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { projectBlock } from '../lib/project-draft';
import { toProjectRepositoryInputs, toProjectRepositoryRows } from '../lib/project-rows';
import { DeleteProjectDialog } from './delete-project';

/** The one field the form validates; the rest of the dialog is picked, not typed. */
const nameSchema = createProjectSchema.pick({ name: true });
type NameValues = { name: string };

/** A project's rows as the list holds them: its repositories, with their bases. */
function rowsOf(project: ProjectEntity | undefined): RepositoryRowValue[] {
  return (project?.repositories ?? []).map((repository) => ({
    id: repositoryKey({
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
    }),
    isDefault: repository.isDefault,
    branch: repository.baseBranch ?? '',
  }));
}

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
        <DialogContent closeLabel={t('common.close')} className="max-w-135">
          <DialogHeader>
            <DialogTitle>{t('projects.dialog.editTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="pb-7">
              {projects.isPending ? (
                <Skeleton className="h-30 w-full" />
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
    <ProjectForm key={project?.id ?? 'new'} project={project} onClose={onClose} onSaved={onSaved} />
  );
}

/**
 * The dialog once the project it edits is known. Keyed above so a different
 * project is a fresh form rather than one reset by an effect.
 */
function ProjectForm({
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
  const [rows, setRows] = useState<RepositoryRowValue[]>(() => rowsOf(project));
  const [defaultHostId, setDefaultHostId] = useState<string | null>(project?.defaultHostId ?? null);
  const [defaultAgent, setDefaultAgent] = useState<CodingAgentId | null>(
    project?.defaultAgent ?? null,
  );
  const [deleting, setDeleting] = useState(false);

  const hosts = useHosts();
  const installations = useInstallations();
  const repositories = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const added = rows.flatMap((row) => {
    const ref = parseRepositoryKey(row.id);
    return ref ? [ref] : [];
  });
  // The branches of the added rows only, as on the scope chip: a call per row
  // nobody added is a rate limit spent on nothing.
  const branches = useRepositoryBranchesFor(added);
  // The archive's own fence: resolved rows stay for ever so the slug is never
  // reissued, and they do not hold a project. A count, so a poll that changes
  // nothing about this project re-renders nothing here.
  const { data: openSessionCount } = useSessions({
    select: (sessions) =>
      project
        ? sessions.filter((row) => row.projectId === project.id && row.lifecycle !== 'resolved')
            .length
        : 0,
  });

  const options = toProjectRepositoryRows(repositories.repositories, branches.byRepository);
  const defaultBranches = new Map(options.map((option) => [option.id, option.defaultBranch]));
  // A row whose branch is empty stands for the repository's own default; the
  // pill prints a value, so it is filled once the option is known.
  const shown = rows.map((row) =>
    row.branch ? row : { ...row, branch: defaultBranches.get(row.id) ?? '' },
  );

  const create = useCreateProject({ onSuccess: onSaved });
  const update = useUpdateProject({ onSuccess: onSaved });
  const pending = create.isPending || update.isPending;
  const failure = create.error ?? update.error;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<NameValues>({
    resolver: useZodResolver(nameSchema),
    defaultValues: { name: project?.name ?? '' },
  });
  // The footer's Save reads the name as it is typed; this dialog is the lowest
  // component that shows the answer, so the subscription is here.
  const name = useWatch({ control, name: 'name' });
  const block = projectBlock(
    fixed ? t('projects.unassigned') : (name ?? ''),
    { rows, defaultHostId, defaultAgent },
    { holdsNone: fixed },
  );
  const hostName = hosts.data?.find((host) => host.id === defaultHostId)?.name;
  const agentLabel = defaultAgent ? CODING_AGENTS[defaultAgent].label : undefined;
  const cloned = rows.filter((row) => row.isDefault).length;
  const defaultsSummary = [
    hostName,
    agentLabel,
    rows.length ? t('projects.dialog.clonedCount', { count: cloned }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  /** The add field's ids, reconciled with the rows: a new one is cloned by default on its own branch. */
  function setAdded(ids: string[]) {
    setRows(
      ids.map((id) => rows.find((row) => row.id === id) ?? { id, isDefault: true, branch: '' }),
    );
  }

  function submit(values: NameValues) {
    if (block) return;
    const input = {
      // Unassigned keeps its name, so the name is not sent for it.
      ...(fixed ? {} : { name: values.name.trim() }),
      // Unassigned with no repository leaves the list as it is: the API holds a
      // project's repositories to at least one whenever they are sent.
      ...(fixed && shown.length === 0
        ? {}
        : { repositories: toProjectRepositoryInputs(shown, defaultBranches) }),
      defaultHostId,
      defaultAgent,
    };
    if (project) update.mutate({ id: project.id, input });
    else
      create.mutate({
        ...input,
        name: values.name.trim(),
        repositories: toProjectRepositoryInputs(shown, defaultBranches),
      });
  }

  const loadingRows = installations.isPending || repositories.isPending;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent closeLabel={t('common.close')} className="max-w-135">
          <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>
                {editing ? t('projects.dialog.editTitle') : t('projects.dialog.newTitle')}
              </DialogTitle>
            </DialogHeader>

            <DialogBody>
              <div className="flex flex-col gap-5.5">
                {failure ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {
                        resolveError(
                          failure,
                          t(editing ? 'projects.dialog.saveFailed' : 'projects.dialog.failed'),
                        ).message
                      }
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="project-name">{t('projects.dialog.name')}</FieldLabel>
                  {fixed ? (
                    <Input id="project-name" value={t('projects.unassigned')} readOnly disabled />
                  ) : (
                    <Input
                      {...register('name')}
                      id="project-name"
                      placeholder={t('projects.dialog.namePlaceholder')}
                      aria-invalid={Boolean(errors.name)}
                      disabled={pending}
                      autoFocus
                    />
                  )}
                  <FieldError errors={[errors.name]} />
                  {fixed ? (
                    <FieldDescription>{t('projects.dialog.unassignedHint')}</FieldDescription>
                  ) : null}
                </Field>

                <Field>
                  <FieldLabel>{t('projects.dialog.repositories')}</FieldLabel>
                  {loadingRows ? (
                    <Skeleton className="h-(--control-h-md) w-full" />
                  ) : (
                    <RepositoryAddField
                      repositories={options}
                      value={rows.map((row) => row.id)}
                      onValueChange={setAdded}
                      placeholder={t('projects.dialog.addRepository')}
                      emptyText={(query) =>
                        query
                          ? t('projects.dialog.noMatch', { query })
                          : t('projects.dialog.allAdded')
                      }
                      removeLabel={(name) => t('projects.dialog.remove', { name })}
                    />
                  )}
                  {rows.length === 0 ? (
                    <FieldDescription>{t('projects.dialog.repositoriesHint')}</FieldDescription>
                  ) : null}
                </Field>

                <Disclosure>
                  <DisclosureTrigger meta={t('projects.dialog.optional')} summary={defaultsSummary}>
                    {t('projects.dialog.defaults')}
                  </DisclosureTrigger>
                  <DisclosurePanel>
                    <div className="flex flex-col gap-4.5">
                      <p className="m-0 text-[13px] text-pretty text-fg-muted">
                        {t('projects.dialog.defaultsHint')}
                      </p>

                      <div className="flex flex-col gap-2">
                        <span className="text-[12.5px] text-fg-muted">
                          {t('projects.dialog.host')}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {hosts.isPending ? (
                            <Skeleton className="h-7 w-24" />
                          ) : hosts.data?.length ? (
                            hosts.data.map((host) => (
                              <Chip
                                key={host.id}
                                selected={defaultHostId === host.id}
                                onClick={() =>
                                  setDefaultHostId((current) =>
                                    current === host.id ? null : host.id,
                                  )
                                }
                              >
                                {host.name}
                              </Chip>
                            ))
                          ) : (
                            <FieldDescription>{t('projects.dialog.noHost')}</FieldDescription>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[12.5px] text-fg-muted">
                          {t('projects.dialog.agent')}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {CODING_AGENT_IDS.map((agent) => (
                            <Chip
                              key={agent}
                              selected={defaultAgent === agent}
                              icon={<AgentMark agent={agent} />}
                              onClick={() =>
                                setDefaultAgent((current) => (current === agent ? null : agent))
                              }
                            >
                              {CODING_AGENTS[agent].label}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[12.5px] text-fg-muted">
                          {t('projects.dialog.clonedByDefault')}
                        </span>
                        {rows.length === 0 ? (
                          <p className="m-0 text-[12.5px] text-fg-subtle">
                            {t('projects.dialog.selectFirst')}
                          </p>
                        ) : (
                          <RepositoryRowList
                            repositories={options}
                            value={shown}
                            onValueChange={setRows}
                            defaultTitle={t('projects.dialog.clonedTitle')}
                            branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
                            branchEmptyText={(query) => t('projects.dialog.branchEmpty', { query })}
                            branchLabel={(name) =>
                              t('sessions.new.repository.branchPane', { name })
                            }
                          />
                        )}
                      </div>
                    </div>
                  </DisclosurePanel>
                </Disclosure>
              </div>
            </DialogBody>

            <DialogFooter>
              {project && !fixed ? (
                <>
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    disabled={pending || Boolean(openSessionCount)}
                    title={
                      openSessionCount
                        ? t('projects.dialog.deleteBlocked', { count: openSessionCount })
                        : t('projects.dialog.deleteHint')
                    }
                    onClick={() => setDeleting(true)}
                  >
                    {t('projects.dialog.delete')}
                  </Button>
                  <span className="flex-1" />
                </>
              ) : null}
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={pending || block !== null}>
                {editing
                  ? update.isPending
                    ? t('projects.dialog.saving')
                    : t('projects.dialog.save')
                  : create.isPending
                    ? t('projects.dialog.creating')
                    : t('projects.dialog.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {project && deleting ? (
        <DeleteProjectDialog
          project={project}
          onClose={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}
