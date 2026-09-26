import {
  AgentMark,
  Alert,
  AlertDescription,
  Button,
  Chip,
  Field,
  FieldDescription,
  FieldLabel,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderTitleInput,
  RepositoryRowList,
  type RepositoryRowValue,
  RoutineStep,
  RoutineSteps,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, Folder } from '@oppenheimer/design-system-web/icons';
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
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DeleteProjectDialog } from '../dialogs/delete-project';
import { projectBlock, repositorySummary } from '../lib/project-draft';
import { toProjectRepositoryInputs, toProjectRepositoryRows } from '../lib/project-rows';

/** The one field the form validates; the rest of the page is picked, not typed. */
const nameSchema = createProjectSchema.pick({ name: true });
type NameValues = { name: string };

/** A project's rows as the picker holds them: its repositories, ticked, with their bases. */
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
 * New project, and Project settings: the page over the main column behind
 * the project chip's foot row, the sidebar's plus and a project header's cog
 * (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * The 2026-09-26 evening export made it a page rather than a dialog, built
 * like the automation editor: a page header whose title is the name, Cancel
 * and Save on its right, a recap line under it that says what is still
 * missing or reads the project back once it is whole; then three numbered
 * steps — the repositories (tick to include, mark Default to clone into
 * every new session, a base-branch pill per row), the default host as
 * chips, the default agent as chips — each ticking itself done with a
 * summary on the right. Editing adds a Delete project row at the foot,
 * blocked while the project holds unresolved sessions, because the API
 * refuses exactly that.
 *
 * It owns its mutations and its reads because it is the component that
 * renders each result. The branches are read only for the ticked rows, as
 * on the scope chip: a call per row nobody ticked is a rate limit spent on
 * nothing. Creating lands on New session with the project picked, which is
 * what a person who just made one wants next; saving returns to the console.
 */
export function ProjectScreen({ projectId }: { projectId?: string }) {
  const projects = useProjects();
  const project = projectId ? projects.data?.find((row) => row.id === projectId) : undefined;
  const editing = projectId !== undefined;

  if (editing && !project) {
    return projects.isPending ? (
      <div className="flex-1 bg-canvas p-8">
        <Skeleton className="h-9 w-64" />
      </div>
    ) : null;
  }

  return <ProjectForm key={project?.id ?? 'new'} project={project} />;
}

/**
 * The page once the project it edits is known. Keyed by the section above
 * so a different project is a fresh form rather than one reset by an effect.
 */
function ProjectForm({ project }: { project: ProjectEntity | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const editing = project !== undefined;
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
  const ticked = rows.flatMap((row) => {
    const ref = parseRepositoryKey(row.id);
    return ref ? [ref] : [];
  });
  const branches = useRepositoryBranchesFor(ticked);
  // The archive's own fence: resolved rows stay for ever so the slug is never
  // reissued, and they do not hold a project. A boolean count, so a poll that
  // changes nothing about this project re-renders nothing here.
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
    onSuccess: (created) => navigate({ to: '/sessions/new', search: { project: created.id } }),
  });
  const update = useUpdateProject({ onSuccess: () => navigate({ to: '/sessions' }) });
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
  // The recap under the title reads the name as it is typed; this page is the
  // lowest component that shows it, so the subscription is here.
  const name = useWatch({ control, name: 'name' });
  const block = projectBlock(name ?? '', { rows, defaultHostId, defaultAgent });
  const summary = repositorySummary(rows);
  const hostName = hosts.data?.find((host) => host.id === defaultHostId)?.name;
  const agentLabel = defaultAgent ? CODING_AGENTS[defaultAgent].label : undefined;

  function submit(values: NameValues) {
    if (block) return;
    const input = {
      name: values.name.trim(),
      repositories: toProjectRepositoryInputs(shown, defaultBranches),
      defaultHostId,
      defaultAgent,
    };
    if (project) update.mutate({ id: project.id, input });
    else create.mutate(input);
  }

  const back = editing ? { to: '/sessions' as const } : { to: '/sessions/new' as const };
  const loadingRows = installations.isPending || repositories.isPending;
  const repositoriesDone = summary.count > 0 && summary.defaults > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">
      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="mx-auto flex w-full max-w-190 flex-col px-8 pt-6 pb-18"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 mb-4.5 self-start"
          render={<Link {...back} />}
        >
          <ChevronLeft />
          {t('projects.page.back')}
        </Button>

        <PageHeader className="mb-7">
          <PageHeaderCrumbs>
            <Link {...back}>
              {editing ? t('projects.page.crumbSessions') : t('projects.page.crumbNewSession')}
            </Link>
            <span>/</span>
            <PageHeaderHere>
              {editing ? t('projects.page.editTitle') : t('projects.page.newTitle')}
            </PageHeaderHere>
          </PageHeaderCrumbs>
          <PageHeaderRow
            icon={<Folder />}
            title={
              <PageHeaderTitleInput
                {...register('name')}
                aria-label={t('projects.page.name')}
                placeholder={t('projects.page.namePlaceholder')}
                aria-invalid={Boolean(errors.name)}
                disabled={pending}
                autoFocus={!editing}
              />
            }
            actions={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  render={<Link {...back} />}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" size="sm" disabled={pending || block !== null}>
                  {editing
                    ? update.isPending
                      ? t('projects.page.saving')
                      : t('projects.page.save')
                    : create.isPending
                      ? t('projects.page.creating')
                      : t('projects.page.create')}
                </Button>
              </>
            }
          />
          <PageHeaderMeta>
            {/* The recap: what is still missing, or the project read back. */}
            <span className={block ? undefined : 'text-fg'}>
              {block
                ? t(`projects.page.recap.${block}`)
                : [t('projects.page.summary.repositories', summary), hostName, agentLabel]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </PageHeaderMeta>
        </PageHeader>

        {failure ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {
                resolveError(
                  failure,
                  t(editing ? 'projects.page.saveFailed' : 'projects.page.failed'),
                ).message
              }
            </AlertDescription>
          </Alert>
        ) : null}

        <RoutineSteps>
          <RoutineStep
            number={1}
            title={t('projects.page.steps.repositories.title')}
            subtitle={t('projects.page.steps.repositories.subtitle')}
            done={repositoriesDone}
            summary={t('projects.page.summary.repositories', summary)}
          >
            <Field>
              <div className="flex items-baseline gap-2">
                <FieldLabel className="flex-1">
                  {t('projects.page.steps.repositories.label')}
                </FieldLabel>
                <span className="figures text-xs text-fg-subtle">
                  {t('projects.page.steps.repositories.defaultCount', {
                    defaults: summary.defaults,
                    count: summary.count,
                  })}
                </span>
              </div>
              <FieldDescription>{t('projects.page.steps.repositories.hint')}</FieldDescription>
              {loadingRows ? (
                <Skeleton className="h-30 w-full" />
              ) : (
                <RepositoryRowList
                  repositories={options}
                  value={shown}
                  onValueChange={setRows}
                  searchPlaceholder={t('projects.page.steps.repositories.search')}
                  emptyText={(query) =>
                    query
                      ? t('projects.page.steps.repositories.noMatch', { query })
                      : t('projects.page.steps.repositories.none')
                  }
                  defaultLabel={t('projects.page.steps.repositories.default')}
                  defaultTitle={t('projects.page.steps.repositories.defaultTitle')}
                  branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
                  branchEmptyText={(query) =>
                    t('projects.page.steps.repositories.branchEmpty', { query })
                  }
                  branchLabel={(name) => t('sessions.new.repository.branchPane', { name })}
                />
              )}
            </Field>
          </RoutineStep>

          <RoutineStep
            number={2}
            title={t('projects.page.steps.host.title')}
            subtitle={t('projects.page.steps.host.subtitle')}
            done={hostName !== undefined}
            summary={hostName}
          >
            <div className="flex flex-wrap gap-1.5">
              {hosts.isPending ? (
                <Skeleton className="h-7 w-24" />
              ) : hosts.data?.length ? (
                hosts.data.map((host) => (
                  <Chip
                    key={host.id}
                    selected={defaultHostId === host.id}
                    onClick={() =>
                      setDefaultHostId((current) => (current === host.id ? null : host.id))
                    }
                  >
                    {host.name}
                  </Chip>
                ))
              ) : (
                <FieldDescription>{t('projects.page.steps.host.none')}</FieldDescription>
              )}
            </div>
          </RoutineStep>

          <RoutineStep
            number={3}
            title={t('projects.page.steps.agent.title')}
            subtitle={t('projects.page.steps.agent.subtitle')}
            done={agentLabel !== undefined}
            summary={agentLabel}
            last
          >
            <div className="flex flex-wrap gap-1.5">
              {CODING_AGENT_IDS.map((agent) => (
                <Chip
                  key={agent}
                  selected={defaultAgent === agent}
                  icon={<AgentMark agent={agent} />}
                  onClick={() => setDefaultAgent((current) => (current === agent ? null : agent))}
                >
                  {CODING_AGENTS[agent].label}
                </Chip>
              ))}
            </div>
          </RoutineStep>
        </RoutineSteps>

        {project ? (
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-border-subtle bg-card px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium text-fg">{t('projects.page.delete.title')}</span>
              <span className="text-sm text-pretty text-fg-muted">
                {openSessionCount
                  ? t('projects.page.delete.blocked', { count: openSessionCount })
                  : t('projects.page.delete.hint')}
              </span>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending || Boolean(openSessionCount)}
              onClick={() => setDeleting(true)}
            >
              {t('projects.page.delete.action')}
            </Button>
          </div>
        ) : null}
      </form>

      {project && deleting ? (
        <DeleteProjectDialog
          project={project}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate({ to: '/sessions' })}
        />
      ) : null}
    </div>
  );
}
