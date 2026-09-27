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
  FieldLabel,
  Input,
  RepositoryDefaultRows,
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
  useRepositoryBranchesFor,
  useSessions,
  useUpdateProject,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import { createProjectSchema } from '@oppenheimer/shared/schemas/project';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { projectBlock } from '../lib/project-draft';
import { toProjectRepositoryInputs, toProjectRepositoryRows } from '../lib/project-rows';
import { DeleteProjectDialog } from './delete-project';

/** The one field the form validates; the rest of the dialog is picked, not typed. */
const nameSchema = createProjectSchema.pick({ name: true });
type NameValues = { name: string };

/** A project's rows as the pickers hold them: its repositories, with their bases. */
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
 * New project, and Project settings: a dialog over the console
 * (`design/version1/SessionsConsole.dc.html`, the `proj-title` dialog),
 * opened from the project chip's foot row and the sidebar's New project
 * (creating), and from a project header's cog (editing). It has no address:
 * the trigger holds it open, as a drawer holds its own.
 *
 * The 2026-09-27 export draws it as the dialog it was before the 2026-09-26
 * evening export made it a page: the name; the repositories, an "Add a
 * repository…" combobox over the ones the App can see and the chosen ones as
 * rows that come off again; then a folding "Defaults · optional" — the
 * default host and agent as chips, and which repositories every new session
 * clones, each with its base branch. The footer is Cancel and Create/Save,
 * and, editing, Delete project on the left behind its confirm — off while
 * the project holds unresolved sessions, because the API refuses exactly
 * that. The workspace's Unassigned keeps its name and has no Delete.
 *
 * Save is off until the project has a name, a repository and one of them
 * cloned by default (the schema's rule); the line under the repositories
 * says which is missing. It owns its mutations and its reads because it is
 * the component that renders each result. The branches are read only for
 * the chosen rows, as on the scope chip. What happens after a create is the
 * trigger's: the chip picks the new project, the sidebar opens New session
 * on it.
 *
 * Keyed by the trigger on the project it edits, so a different project is a
 * fresh dialog rather than one reset by an effect.
 */
export function ProjectDialog({
  project,
  onClose,
  onCreated,
}: {
  /** The project to edit; absent, the dialog creates one. */
  project?: ProjectEntity;
  onClose: () => void;
  onCreated: (project: ProjectEntity) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const nameId = useId();
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
  const chosen = rows.flatMap((row) => {
    const ref = parseRepositoryKey(row.id);
    return ref ? [ref] : [];
  });
  const branches = useRepositoryBranchesFor(chosen);
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
  // picker prints a value, so it is filled once the option is known.
  const shown = rows.map((row) =>
    row.branch ? row : { ...row, branch: defaultBranches.get(row.id) ?? '' },
  );

  const create = useCreateProject({
    onSuccess: (created) => {
      onCreated(created);
      onClose();
    },
  });
  const update = useUpdateProject({ onSuccess: onClose });
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
  // Save reads whether there is a name as it is typed; the dialog is the
  // lowest component that shows that, so the subscription is here.
  const name = useWatch({ control, name: 'name' });
  const block = projectBlock(
    fixed ? t('projects.unassigned') : (name ?? ''),
    { rows, defaultHostId, defaultAgent },
    { holdsNone: fixed },
  );
  const hostName = hosts.data?.find((host) => host.id === defaultHostId)?.name;
  const agentLabel = defaultAgent ? CODING_AGENTS[defaultAgent].label : undefined;
  const cloned = rows.filter((row) => row.isDefault).length;
  const summary = [
    hostName,
    agentLabel,
    rows.length > 0 ? t('projects.dialog.defaults.clonedSummary', { count: cloned }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

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
  const repositoriesHint =
    rows.length === 0 && !fixed
      ? t('projects.dialog.repositories.hint')
      : block === 'default'
        ? t('projects.dialog.repositories.needsDefault')
        : null;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent closeLabel={t('common.close')} className="sm:max-w-135">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('projects.dialog.editTitle') : t('projects.dialog.newTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
              <div className="flex flex-col gap-5.5">
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor={nameId}>{t('projects.dialog.name')}</FieldLabel>
                  {fixed ? (
                    <Input id={nameId} value={t('projects.unassigned')} readOnly disabled />
                  ) : (
                    <Input
                      id={nameId}
                      {...register('name')}
                      placeholder={t('projects.dialog.namePlaceholder')}
                      aria-invalid={Boolean(errors.name)}
                      disabled={pending}
                      autoFocus={!editing}
                    />
                  )}
                  {fixed ? (
                    <FieldDescription>{t('projects.dialog.unassignedHint')}</FieldDescription>
                  ) : null}
                </Field>

                <Field>
                  <FieldLabel>{t('projects.dialog.repositories.label')}</FieldLabel>
                  {loadingRows ? (
                    <Skeleton className="h-8.5 w-full" />
                  ) : (
                    <RepositoryRowList
                      repositories={options}
                      value={shown}
                      onValueChange={setRows}
                      disabled={pending}
                      placeholder={t('projects.dialog.repositories.add')}
                      emptyText={(query) =>
                        query
                          ? t('projects.dialog.repositories.noMatch', { query })
                          : t('projects.dialog.repositories.none')
                      }
                      removeLabel={(name) => t('projects.dialog.repositories.remove', { name })}
                    />
                  )}
                  {repositoriesHint ? (
                    <FieldDescription>{repositoriesHint}</FieldDescription>
                  ) : null}
                </Field>

                <Disclosure>
                  <DisclosureTrigger
                    meta={t('projects.dialog.defaults.optional')}
                    summary={summary || undefined}
                  >
                    {t('projects.dialog.defaults.label')}
                  </DisclosureTrigger>
                  <DisclosurePanel>
                    <div className="flex flex-col gap-4.5 pt-3.5">
                      <p className="text-[13px] text-pretty text-fg-muted">
                        {t('projects.dialog.defaults.hint')}
                      </p>

                      <div className="flex flex-col gap-2">
                        <span className="text-[12.5px] text-fg-muted">
                          {t('projects.dialog.defaults.host')}
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
                            <FieldDescription>
                              {t('projects.dialog.defaults.noHost')}
                            </FieldDescription>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[12.5px] text-fg-muted">
                          {t('projects.dialog.defaults.agent')}
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
                          {t('projects.dialog.defaults.cloned')}
                        </span>
                        {rows.length === 0 ? (
                          <p className="text-[12.5px] text-fg-subtle">
                            {t('projects.dialog.defaults.clonedNone')}
                          </p>
                        ) : (
                          <RepositoryDefaultRows
                            repositories={options}
                            value={shown}
                            onValueChange={setRows}
                            disabled={pending}
                            branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
                            branchEmptyText={(query) =>
                              t('projects.dialog.repositories.branchEmpty', { query })
                            }
                            branchLabel={(name) =>
                              t('sessions.new.repository.branchPane', { name })
                            }
                          />
                        )}
                      </div>
                    </div>
                  </DisclosurePanel>
                </Disclosure>

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
              </div>
            </DialogBody>

            <DialogFooter>
              {project && !fixed ? (
                <Button
                  type="button"
                  variant="ghost-danger"
                  className="sm:mr-auto"
                  disabled={pending || Boolean(openSessionCount)}
                  title={
                    openSessionCount
                      ? t('projects.dialog.delete.blocked', { count: openSessionCount })
                      : t('projects.dialog.delete.hint')
                  }
                  onClick={() => setDeleting(true)}
                >
                  {t('projects.dialog.delete.action')}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
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
