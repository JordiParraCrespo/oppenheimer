import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import {
  useCreateSession,
  useHosts,
  useInstallationRepositoriesFor,
  useInstallations,
  useProjects,
  useRepositoryBranchesFor,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentSelect } from '../components/agent-select';
import { BranchSelect } from '../components/branch-select';
import { EffortSelect } from '../components/effort-select';
import { HostSelect } from '../components/host-select';
import { NewSessionComposer } from '../components/new-session-composer';
import { PermissionSelect } from '../components/permission-select';
import { ProjectSelect } from '../components/project-select';
import { RepositoryBranchSelect } from '../components/repository-branch-select';
import { AddHostDialog } from '../dialogs/add-host';
import { ProjectDialog } from '../dialogs/project';
import { useNewSessionDraft } from '../hooks/use-new-session-draft';
import {
  launchControlsFor,
  parseRepositoryKey,
  projectPrefill,
  toAgentOptions,
  toBranchOptions,
  toCheckouts,
  toHostOptions,
  toLaunchInput,
  toProjectOptions,
  toRepositoryOptions,
} from '../lib/session-options';

/**
 * New session: the scope band, the composer, and the one request they make.
 *
 * This is the only component on the screen that fetches or mutates — the
 * chips below it are props-in, choice-out, so a settle of the host list does
 * not re-render a branch pane and a keystroke in the composer re-renders
 * nothing but the composer.
 *
 * The chips sit in the composer's `scope` slot, the grey band fused to the
 * top of the field (the 2026-09-26 export's tabbed composer): project first,
 * because picking one prefills the rest
 * (`product/versions/mvp/12-projects-on-the-console.md`); then the host, the
 * repository, and the branch while exactly one repository is selected.
 *
 * Add host and New project are this component's dialogs rather than the
 * chips': a chip's foot action only says "open it", and where what the
 * dialog made lands — the draft — is here.
 *
 * Five reads, and they are not the same read five times: the projects, the
 * hosts, the installations' repositories, the branches of the repositories
 * somebody has actually picked, and the deployment's GitHub App install URL.
 * The branches are deliberately late — the API answers them live from
 * GitHub, so a call per row of a picker nobody has opened is a rate limit
 * spent on nothing. The install URL is the kernel's capabilities read, the
 * one the sign-in and onboarding screens share: cached and persisted, so it
 * costs no request here.
 */
export function NewSessionForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { draft, update, setEngine } = useNewSessionDraft();
  const [addingHost, setAddingHost] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const projects = useProjects();
  const hosts = useHosts();
  const installations = useInstallations();
  const installUrl = useDeploymentCapabilities({
    select: (deployment) => deployment.github_app_install_url,
  });
  const repositories = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const selected = draft.scope.flatMap((scope) => {
    const ref = parseRepositoryKey(scope.id);
    return ref ? [ref] : [];
  });
  const branches = useRepositoryBranchesFor(selected);

  /**
   * The key that makes a second press of send safe.
   *
   * It is minted once per draft and kept until a session is created: if the
   * first response was lost, the retry returns the session that request already
   * made rather than building a second worktree and a second branch.
   */
  const idempotencyKey = useRef(crypto.randomUUID());
  const create = useCreateSession({
    onSuccess: (session) => {
      idempotencyKey.current = crypto.randomUUID();
      navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } });
    },
  });

  // A remembered project the workspace no longer has, or one not yet loaded,
  // is shown as none rather than as an id: the list is the truth once it
  // answers, and only then is "that project is gone" a fact.
  const project = projects.data?.find((candidate) => candidate.id === draft.projectId) ?? null;
  const projectId = project?.id ?? null;

  const repositoryOptions = toRepositoryOptions(repositories.repositories, branches.byRepository, {
    archived: t('sessions.new.repository.archived'),
  });
  // The lone branch chip tells the truth only while exactly one repository is
  // selected; with two there are two base branches and one chip cannot say so.
  const onlyScope = draft.scope.length === 1 ? draft.scope[0] : undefined;
  const onlyRef = onlyScope ? parseRepositoryKey(onlyScope.id) : null;
  const controls = launchControlsFor(draft.agent);
  const onlyBranches = onlyRef ? (branches.byRepository.get(onlyRef.githubRepoId) ?? []) : [];

  /** Picking a project: the chip, then what its defaults set on the others. */
  function pick(next: ProjectEntity) {
    update({
      projectId: next.id,
      ...projectPrefill(
        next,
        (hosts.data ?? []).map((host) => host.id),
      ),
    });
  }

  function start(prompt: string) {
    if (!draft.hostId) return;
    create.mutate({
      idempotencyKey: idempotencyKey.current,
      input: {
        hostId: draft.hostId,
        agent: draft.agent,
        ...(projectId ? { projectId } : {}),
        checkouts: toCheckouts(draft.scope),
        launch: toLaunchInput(draft),
        prompt,
      },
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4.5">
        <NewSessionComposer
          onSubmit={start}
          busy={create.isPending}
          disabled={!draft.hostId}
          scope={
            // A fieldset rather than a div with `role="group"`: the chips are
            // one decision — where this session runs — and a screen reader
            // announces the legend once for all of them. Pending is `loading`,
            // settled-and-empty is the empty line plus the chip's own foot
            // action, and `disabled` is only for a chip this screen forbids —
            // which none of these are.
            <fieldset aria-label={t('sessions.new.title')} className="contents">
              <ProjectSelect
                projects={toProjectOptions(projects.data ?? [], {
                  noRepositories: t('sessions.new.project.noRepositories'),
                })}
                value={projectId}
                onValueChange={(id) => {
                  const next = projects.data?.find((candidate) => candidate.id === id);
                  if (next) pick(next);
                }}
                onNewProject={() => setCreatingProject(true)}
                loading={projects.isPending}
                variant="tab"
              />
              <HostSelect
                hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
                value={draft.hostId}
                onValueChange={(hostId) => update({ hostId })}
                onAddHost={() => setAddingHost(true)}
                loading={hosts.isPending}
                variant="tab"
              />
              <RepositoryBranchSelect
                repositories={repositoryOptions}
                value={draft.scope}
                onValueChange={(scope) => update({ scope })}
                manageUrl={installUrl.data ?? null}
                loading={installations.isPending || repositories.isPending || installUrl.isPending}
                branchesLoading={branches.isPending}
                variant="tab"
              />
              {onlyScope ? (
                <BranchSelect
                  branches={toBranchOptions(onlyBranches, {
                    default: t('sessions.new.branch.default'),
                  })}
                  value={onlyScope.branch}
                  onValueChange={(branch) => update({ scope: [{ id: onlyScope.id, branch }] })}
                  loading={branches.isPending}
                  variant="tab"
                />
              ) : null}
            </fieldset>
          }
          tools={
            controls.permission ? (
              <PermissionSelect
                value={draft.permission}
                onValueChange={(permission) => update({ permission })}
              />
            ) : null
          }
          engine={
            <>
              <AgentSelect
                agents={toAgentOptions()}
                value={{ agent: draft.agent, model: draft.model }}
                onValueChange={(engine) =>
                  setEngine(engine.agent as typeof draft.agent, engine.model)
                }
              />
              {controls.effort ? (
                <EffortSelect value={draft.effort} onValueChange={(effort) => update({ effort })} />
              ) : null}
            </>
          }
        />

        {create.isError ? (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        ) : null}
      </div>

      {addingHost ? (
        <AddHostDialog
          onClose={() => setAddingHost(false)}
          onUseHost={(hostId) => {
            update({ hostId });
            setAddingHost(false);
          }}
        />
      ) : null}

      {creatingProject ? (
        <ProjectDialog
          onClose={() => setCreatingProject(false)}
          onCreated={(created) => {
            pick(created);
            setCreatingProject(false);
          }}
        />
      ) : null}
    </>
  );
}
