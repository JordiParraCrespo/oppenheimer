import {
  useCreateSession,
  useHosts,
  useInstallationRepositoriesFor,
  useInstallations,
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
import { RepositoryBranchSelect } from '../components/repository-branch-select';
import { AddHostDialog } from '../dialogs/add-host';
import { useNewSessionDraft } from '../hooks/use-new-session-draft';
import {
  launchControlsFor,
  parseRepositoryKey,
  toAgentOptions,
  toBranchOptions,
  toCheckouts,
  toHostOptions,
  toLaunchInput,
  toRepositoryOptions,
} from '../lib/session-options';

/**
 * New session: the chips, the composer, and the one request they make.
 *
 * This is the only component on the screen that fetches or mutates — the four
 * selects below it are props-in, choice-out, so a settle of the host list does
 * not re-render a branch pane and a keystroke in the composer re-renders
 * nothing but the composer.
 *
 * Add host is this component's dialog rather than the chip's: the chip's foot
 * action only says "open it", and where the machine it pairs lands — the draft
 * — is here.
 *
 * Three reads, and they are not the same read four times: the hosts, the
 * installations' repositories, and the branches of the repositories somebody
 * has actually picked. The last is deliberately last — the API answers branches
 * live from GitHub, so a call per row of a picker nobody has opened is a rate
 * limit spent on nothing.
 */
export function NewSessionForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { draft, update, setEngine } = useNewSessionDraft();
  const [addingHost, setAddingHost] = useState(false);

  const hosts = useHosts();
  const installations = useInstallations();
  // Where "Manage repository access" leads: the App's installation page on
  // GitHub, which is the only place the repository list changes.
  const { data: deployment } = useDeploymentCapabilities();
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

  const repositoryOptions = toRepositoryOptions(repositories.repositories, branches.byRepository, {
    archived: t('sessions.new.repository.archived'),
  });
  // The lone branch chip tells the truth only while exactly one repository is
  // selected; with two there are two base branches and one chip cannot say so.
  const onlyScope = draft.scope.length === 1 ? draft.scope[0] : undefined;
  const onlyRef = onlyScope ? parseRepositoryKey(onlyScope.id) : null;
  const controls = launchControlsFor(draft.agent);
  const onlyBranches = onlyRef ? (branches.byRepository.get(onlyRef.githubRepoId) ?? []) : [];

  function start(prompt: string) {
    if (!draft.hostId) return;
    create.mutate({
      idempotencyKey: idempotencyKey.current,
      input: {
        hostId: draft.hostId,
        agent: draft.agent,
        checkouts: toCheckouts(draft.scope),
        launch: toLaunchInput(draft),
        prompt,
      },
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4.5">
        {/* A fieldset rather than a div with `role="group"`: the chips are one
          decision — where this session runs — and a screen reader announces
          the legend once for all of them. */}
        <fieldset aria-label={t('sessions.new.title')} className="flex flex-wrap gap-2">
          {/* Pending is `loading`, settled-and-empty is the empty line plus the
              chip's own foot action, and `disabled` is only for a chip this
              screen forbids — which none of these are. */}
          <HostSelect
            hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
            value={draft.hostId}
            onValueChange={(hostId) => update({ hostId })}
            onAddHost={() => setAddingHost(true)}
            loading={hosts.isPending}
          />
          <RepositoryBranchSelect
            repositories={repositoryOptions}
            value={draft.scope}
            onValueChange={(scope) => update({ scope })}
            manageUrl={deployment?.github_app_install_url ?? undefined}
            loading={installations.isPending || repositories.isPending}
            branchesLoading={branches.isPending}
          />
          {onlyScope ? (
            <BranchSelect
              branches={toBranchOptions(onlyBranches, {
                default: t('sessions.new.branch.default'),
              })}
              value={onlyScope.branch}
              onValueChange={(branch) => update({ scope: [{ id: onlyScope.id, branch }] })}
              loading={branches.isPending}
            />
          ) : null}
        </fieldset>

        <NewSessionComposer
          onSubmit={start}
          busy={create.isPending}
          disabled={!draft.hostId}
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
    </>
  );
}
