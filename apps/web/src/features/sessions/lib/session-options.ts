import type {
  AgentOption,
  ChipSelectOption,
  EffortStop,
  RepositoryOption,
  RepositoryScope,
} from '@oppenheimer/design-system-web';
import {
  type BranchEntity,
  type CreateSessionCheckout,
  type CreateSessionInput,
  type HostEntity,
  type ProjectEntity,
  parseRepositoryKey,
  type RepositoryEntity,
  repositoryKey,
  shortName,
} from '@oppenheimer/frontend-consumer';
import {
  CODING_AGENT_IDS,
  CODING_AGENTS,
  type CodingAgentId,
  effortFor,
  type SessionEffort,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import { MAX_SESSION_CHECKOUTS } from '@oppenheimer/shared/schemas/session';

// The key a picker's row is named by is the console's, kept in the product
// package; re-exported so the chips beside this file read one vocabulary.
export { parseRepositoryKey, repositoryKey } from '@oppenheimer/frontend-consumer';

/**
 * Entities in, option shapes out. Nothing here renders, and nothing here
 * fetches: this is the one place that knows both the console's vocabulary and
 * the design system's, so a picker cannot drift from what the API answered.
 *
 * The one genuinely tricky mapping is the repository's **id**: a row is keyed
 * by the installation and GitHub's id together (`repositoryKey`, the product
 * package's), and the pair is parsed back out when a session is created.
 */

/**
 * The hosts, as the host chip's rows.
 *
 * A host that is offline is shown and selectable rather than hidden: the
 * session is recorded and the work is owed to that machine the moment its
 * runner dials in, which is a real thing to want and is what `host_offline`
 * on the create response means. The second line says so.
 */
export function toHostOptions(
  hosts: readonly HostEntity[],
  labels: { offline: string },
): ChipSelectOption[] {
  return hosts.map((host) => ({
    value: host.id,
    label: host.name,
    description: host.online ? host.summary : `${host.summary} · ${labels.offline}`,
    keywords: host.hostname ?? undefined,
  }));
}

/**
 * The repositories of every connected installation, as the repository chip's
 * rows, with the branches of the ones already picked.
 *
 * Branches arrive per repository and only for the selected ones, so an
 * unselected row carries none: the picker only opens a branch pane for a row
 * that is selected, and it falls back to `defaultBranch` until the read lands.
 */
export function toRepositoryOptions(
  repositories: readonly { repository: RepositoryEntity; installationId: string }[],
  branches: ReadonlyMap<number, readonly BranchEntity[]>,
  labels: { archived: string },
): RepositoryOption[] {
  return repositories.map(({ repository, installationId }) => ({
    id: repositoryKey({ installationId, githubRepoId: repository.githubRepoId }),
    name: repository.name,
    description: repository.archived ? labels.archived : repository.fullName,
    keywords: repository.fullName,
    defaultBranch: repository.defaultBranch,
    branches: (branches.get(repository.githubRepoId) ?? []).map((branch) => ({
      value: branch.name,
    })),
  }));
}

/** The branches of one repository, as the lone branch chip's rows. */
export function toBranchOptions(
  branches: readonly BranchEntity[],
  labels: { default: string },
): ChipSelectOption[] {
  return branches.map((branch) => ({
    value: branch.name,
    label: branch.name,
    mono: true,
    description: branch.isDefault ? labels.default : undefined,
  }));
}

/**
 * The agents, as the engine button's two panes.
 *
 * The catalog is the source: an agent with no models is picked outright and
 * the button names the agent, which is exactly the case the plain terminal is
 * in.
 */
export function toAgentOptions(): AgentOption[] {
  return CODING_AGENT_IDS.map((id) => ({
    id,
    label: CODING_AGENTS[id].label,
    models: CODING_AGENTS[id].models.map((model) => ({
      value: model.id,
      label: model.label,
    })),
  }));
}

/** The model an agent runs when nobody has chosen one. */
export function defaultModelFor(agent: CodingAgentId): string | null {
  const models = CODING_AGENTS[agent].models;
  return (models.find((model) => model.default) ?? models[0])?.id ?? null;
}

/**
 * Whether an agent takes a permission level, read off its catalog entry once:
 * a control the catalog declares nothing for is neither drawn nor sent. The
 * blank terminal takes none. Effort is not here because it is the model's, not
 * the agent's — `effortChoiceFor`.
 */
export interface LaunchControls {
  permission: boolean;
}

export function launchControlsFor(agent: CodingAgentId): LaunchControls {
  return { permission: CODING_AGENTS[agent].launch.permission !== undefined };
}

/**
 * The effort level somebody last moved the slider to, per agent, as they left
 * it: each agent's levels are its own, and whether a pick applies depends on
 * the model, which is `effortChoiceFor`'s to decide at display time.
 */
export type EffortPicks = Partial<Record<CodingAgentId, string>>;

/**
 * What the effort slider draws for a draft, and whether it is sent.
 *
 * `levels` are the model's, in its own order. `value` is the pick for this
 * agent when the model offers it, and `chosen` says it is sent. Otherwise —
 * nothing picked, or a pick this model does not have (`ultra` on Sol, then a
 * switch to Luna) — the knob shows the model's own default and nothing is
 * sent: the CLI runs as it would unasked, and the pick stays as it was for a
 * model that has it. Null when the model takes no effort, and the slider is
 * hidden.
 */
export interface EffortChoice {
  levels: readonly SessionEffort[];
  value: SessionEffort;
  chosen: boolean;
}

export function effortChoiceFor(
  agent: CodingAgentId,
  model: string | null,
  picked: string | undefined,
): EffortChoice | null {
  const effort = effortFor(agent, model);
  if (!effort) return null;
  const offered = effort.levels.find((level) => level === picked);
  return offered
    ? { levels: effort.levels, value: offered, chosen: true }
    : { levels: effort.levels, value: effort.default, chosen: false };
}

/**
 * The foot row as `POST /sessions` takes it: only the controls this agent and
 * model have. A level the composer still holds from the last agent is dropped
 * rather than sent, so a blank terminal records no permission at all, and an
 * effort nobody picked is left to the CLI.
 */
export function toLaunchInput(draft: {
  agent: CodingAgentId;
  model: string | null;
  permission: SessionPermission;
  efforts: EffortPicks;
}): CreateSessionInput['launch'] {
  const controls = launchControlsFor(draft.agent);
  const effort = effortChoiceFor(draft.agent, draft.model, draft.efforts[draft.agent]);
  return {
    model: draft.model,
    ...(controls.permission ? { permission: draft.permission } : {}),
    ...(effort?.chosen ? { effort: effort.value } : {}),
  };
}

/** A model's levels as slider stops, translated where the call site translates. */
export function toEffortStops(
  levels: readonly SessionEffort[],
  labels: Record<SessionEffort, string>,
): EffortStop<SessionEffort>[] {
  return levels.map((level) => ({ value: level, label: labels[level] }));
}

/**
 * The picker's selection, as `POST /sessions` takes it.
 *
 * A row whose id no longer parses is dropped rather than sent: it would name a
 * repository this workspace cannot reach, and the API would refuse it with a
 * 404 that says nothing useful to whoever is looking at the screen.
 */
export function toCheckouts(scope: readonly RepositoryScope[]): CreateSessionCheckout[] {
  return scope.flatMap((selected) => {
    const ref = parseRepositoryKey(selected.id);
    return ref ? [{ ...ref, baseBranch: selected.branch }] : [];
  });
}

/**
 * The repository selection capped at `MAX_SESSION_CHECKOUTS`, keeping what was
 * just picked: a row added past the cap takes the place of the ones already
 * there. One repository per session in the MVP (#56).
 */
export function capRepositories(
  previous: RepositoryScope[],
  next: RepositoryScope[],
): RepositoryScope[] {
  if (next.length <= MAX_SESSION_CHECKOUTS) return next;
  const added = next.filter((scope) => !previous.some((kept) => kept.id === scope.id));
  return (added.length ? added : next).slice(-MAX_SESSION_CHECKOUTS);
}

/**
 * The projects, as the project chip's rows: the name, and under it the
 * repositories every new session clones — or the word for a project that
 * holds none.
 */
export function toProjectOptions(
  projects: readonly ProjectEntity[],
  labels: { noRepositories: string; unassigned: string },
): ChipSelectOption[] {
  // Unassigned first, under its translated name: it is where work that names
  // no project goes, and the API's spelling of it is English.
  const ordered = [
    ...projects.filter((project) => project.isUnassigned),
    ...projects.filter((project) => !project.isUnassigned),
  ];
  return ordered.map((project) => {
    const defaults = project.defaultRepositories.map((repository) =>
      shortName(repository.fullName),
    );
    return {
      value: project.id,
      label: project.isUnassigned ? labels.unassigned : project.name,
      description: defaults.length ? defaults.join(' · ') : labels.noRepositories,
      keywords: project.repositories.map((repository) => repository.fullName).join(' '),
    };
  });
}

/**
 * What picking a project sets on the draft
 * (`product/versions/mvp/05-screens.md`): the host from its
 * default when that host is still in the list, the first default repository
 * with its base branch, and the agent with that agent's default model. A
 * default the workspace no longer has is skipped rather than written, so the
 * chip never names a machine that is gone.
 */
export function projectPrefill(
  project: ProjectEntity,
  hostIds: readonly string[],
): Partial<Pick<NewSessionDraftShape, 'hostId' | 'scope' | 'agent' | 'model'>> {
  const patch: Partial<Pick<NewSessionDraftShape, 'hostId' | 'scope' | 'agent' | 'model'>> = {};
  if (project.defaultHostId && hostIds.includes(project.defaultHostId)) {
    patch.hostId = project.defaultHostId;
  }
  const [first] = project.defaultRepositories;
  if (first) {
    patch.scope = [
      {
        id: repositoryKey({
          installationId: first.installationId,
          githubRepoId: first.githubRepoId,
        }),
        branch: first.baseBranch ?? '',
      },
    ];
  }
  if (project.defaultAgent) {
    patch.agent = project.defaultAgent;
    patch.model = defaultModelFor(project.defaultAgent);
  }
  return patch;
}

/** The slice of the draft a project prefills; the hook owns the whole shape. */
export interface NewSessionDraftShape {
  hostId: string | null;
  scope: RepositoryScope[];
  agent: CodingAgentId;
  model: string | null;
}
