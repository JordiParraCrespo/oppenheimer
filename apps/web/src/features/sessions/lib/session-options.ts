import type {
  AgentOption,
  ChipSelectOption,
  EffortStop,
  RepositoryOption,
  RepositoryScope,
} from '@oppenheimer/design-system-web';
import type {
  BranchEntity,
  CreateSessionCheckout,
  HostEntity,
  RepositoryEntity,
} from '@oppenheimer/frontend-consumer';
import {
  CODING_AGENT_IDS,
  CODING_AGENTS,
  type CodingAgentId,
  SESSION_EFFORTS,
  type SessionEffort,
} from '@oppenheimer/shared/agents';
import { MAX_SESSION_CHECKOUTS } from '@oppenheimer/shared/schemas/session';

/**
 * Entities in, option shapes out. Nothing here renders, and nothing here
 * fetches: this is the one place that knows both the console's vocabulary and
 * the design system's, so a picker cannot drift from what the API answered.
 *
 * The one genuinely tricky mapping is the repository's **id**. A picker's rows
 * need one string each, and `githubRepoId` alone is not unique across two
 * installations of the App — so a row is keyed by the pair, and the pair is
 * what is parsed back out when a session is created.
 */

/** A repository as this screen holds it: our installation row plus GitHub's id. */
export interface RepositoryRef {
  installationId: string;
  githubRepoId: number;
}

/** The picker's row id: `<installationId>:<githubRepoId>`. */
export function repositoryKey(ref: RepositoryRef): string {
  return `${ref.installationId}:${ref.githubRepoId}`;
}

/** The pair a row id names, or null when it names nothing this screen knows. */
export function parseRepositoryKey(key: string): RepositoryRef | null {
  const separator = key.lastIndexOf(':');
  if (separator < 1) return null;
  const githubRepoId = Number(key.slice(separator + 1));
  if (!Number.isInteger(githubRepoId) || githubRepoId <= 0) return null;
  return { installationId: key.slice(0, separator), githubRepoId };
}

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

/** Whether this agent asks for approvals at all; the plain terminal does not. */
export function hasPermission(agent: CodingAgentId): boolean {
  return CODING_AGENTS[agent].launch.permission !== undefined;
}

/** Whether this agent has any notion of effort at all. */
export function hasEffort(agent: CodingAgentId): boolean {
  return CODING_AGENTS[agent].launch.effort !== undefined;
}

/** The five stops, translated where the call site translates. */
export function toEffortStops(labels: Record<SessionEffort, string>): EffortStop[] {
  return SESSION_EFFORTS.map((stop) => ({ value: stop, label: labels[stop] }));
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
