import type { HostEntity, ProjectEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import { HOST_HOME, type StartTaskSessionVariables } from '@oppenheimer/frontend-consumer/react';
import {
  CODING_AGENTS,
  type CodingAgentId,
  DEFAULT_SESSION_PERMISSION,
  isCodingAgentId,
} from '@oppenheimer/shared/agents';
import {
  AUTOMATION_PLACE_RULES,
  AUTOMATION_PLACES,
  type AutomationPlace,
  isVendorPlace,
} from '@oppenheimer/shared/automations';
import { defaultModelFor } from './agent-options';

/**
 * Where the session runs: on the host, in Claude Code's cloud started from
 * the host, or in Cursor's cloud with no host — the places an automation's
 * runs take too (`AUTOMATION_PLACES`).
 */
export type StartPlace = AutomationPlace;

/** The Start session dialog's choices (`18-plan-product.md` §4). */
export interface StartSessionValues {
  prompt: string;
  /** The project repository's row id; null starts on a host with none, in its home. */
  repositoryId: string | null;
  place: StartPlace;
  /** The host it runs on or starts from; unread at a vendor. */
  hostId: string;
  agent: CodingAgentId;
  /** At a vendor, one of the vendor's models; null is the vendor's own pick. */
  model: string | null;
}

/** The body Start session sends, without what the dialog itself adds. */
export type StartSessionBody =
  | Pick<Extract<StartTaskSessionVariables, { session: unknown }>, 'session'>
  | Pick<Extract<StartTaskSessionVariables, { cloud: unknown }>, 'cloud'>;

/**
 * The repository chip's value for "No repository" (`repositoryId: null`): on a
 * host, a folder session in the host's home, as Open terminal starts
 * (`24-session-places.md` §3). A cloud starts from a repository.
 */
export const NO_REPOSITORY = 'none';

/** What holds the start: a cloud's missing task or repository, a host that must name its home, no hosts. */
export type StartHold = 'task' | 'repository' | 'home' | 'host';

/**
 * Whether Start session can start now, and how (`18-plan-product.md` §4).
 * A cloud starts on a task, from a repository. A host session with no
 * repository needs its host online to say where home is; any other host
 * session to an offline host is queued until the host is back.
 */
export function startReadiness({
  place,
  promptEmpty,
  noRepository,
  hasHosts,
  hostOnline,
}: {
  place: StartPlace;
  promptEmpty: boolean;
  noRepository: boolean;
  hasHosts: boolean;
  /** The picked host's presence; null when none is picked. */
  hostOnline: boolean | null;
}): { hold: StartHold | null; queues: boolean } {
  const rule = AUTOMATION_PLACE_RULES[place];
  const inCloud = rule.host !== 'runs';
  const hold: StartHold | null =
    rule.host !== null && !hasHosts
      ? 'host'
      : inCloud && promptEmpty
        ? 'task'
        : inCloud && noRepository
          ? 'repository'
          : noRepository && hostOnline === false
            ? 'home'
            : null;
  return { hold, queues: hold === null && rule.host !== null && hostOnline === false };
}

export function asPlace(value: string): StartPlace | null {
  return (AUTOMATION_PLACES as readonly string[]).includes(value) ? (value as StartPlace) : null;
}

/** The agent a place runs: its own where it names one, else whatever was picked. */
export function agentFor(place: StartPlace, agent: CodingAgentId): CodingAgentId {
  const own = AUTOMATION_PLACE_RULES[place].agent;
  return own && isCodingAgentId(own) ? own : agent;
}

/**
 * The places as the Where chip lists them, from `AUTOMATION_PLACES`: a
 * vendor's is offered once the reader holds a key for it.
 */
export function placeOptions(
  t: (key: PlaceCopyKey) => string,
  connected: (provider: AutomationPlace) => boolean,
) {
  return AUTOMATION_PLACES.map((place) => {
    const copy = PLACE_COPY[place];
    const ready = !isVendorPlace(place) || connected(place);
    return {
      value: place,
      label: t(copy.label),
      disabled: !ready,
      description: t(ready ? copy.description : copy.connect),
    };
  });
}

const PLACE_COPY = {
  host: {
    label: 'tasks.start.placeHost',
    description: 'tasks.start.placeHostDesc',
    connect: 'tasks.start.placeHostDesc',
  },
  'claude-cloud': {
    label: 'tasks.start.placeClaudeCloud',
    description: 'tasks.start.placeClaudeCloudDesc',
    connect: 'tasks.start.placeClaudeCloudDesc',
  },
  cursor: {
    label: 'tasks.start.placeCursor',
    description: 'tasks.start.placeCursorDesc',
    connect: 'tasks.start.placeCursorConnect',
  },
} as const satisfies Record<AutomationPlace, Record<'label' | 'description' | 'connect', string>>;

type PlaceCopyKey =
  (typeof PLACE_COPY)[AutomationPlace][keyof (typeof PLACE_COPY)[AutomationPlace]];

/**
 * What the dialog opens with: the task's title and notes as the prompt, and the
 * project's defaults — its first default repository (no repository when it
 * has none), its host while the
 * workspace still has it (else an online one), its agent with that agent's
 * default model.
 */
export function startDefaults(
  task: TaskEntity,
  project: ProjectEntity | undefined,
  hosts: readonly HostEntity[],
): StartSessionValues {
  const repository = project?.defaultRepositories[0] ?? project?.repositories[0];
  const host =
    hosts.find((row) => row.id === project?.defaultHostId) ??
    hosts.find((row) => row.online) ??
    hosts[0];
  const agent = project?.defaultAgent ?? 'claude-code';
  return {
    prompt: [task.title, task.notes.trim()].filter(Boolean).join('\n\n'),
    repositoryId: repository?.id ?? null,
    place: 'host',
    hostId: host?.id ?? '',
    agent,
    model: defaultModelFor(agent),
  };
}

/**
 * The body the choices make, from the one repository on its base branch:
 * - on a host, the launch New session would send for this agent unpicked —
 *   the default permission level (`auto`) where the agent takes one, the
 *   CLI's own effort; with no repository, a folder session in the host's
 *   home (`HOST_HOME`, which the start asks the host for);
 * - in Claude Code's cloud, New session's `cloud: true` body from the host,
 *   on a task (the cloud takes no permission level);
 * - at a vendor, `POST /sessions/cloud`'s body, on a task, with no host.
 * Null when the repository is gone, or a cloud place has no task or no
 * repository to start from.
 */
export function toStartSession(
  values: StartSessionValues,
  project: ProjectEntity,
): StartSessionBody | null {
  const repository = project.repositories.find((row) => row.id === values.repositoryId);
  if (values.repositoryId !== null && !repository) return null;
  const prompt = values.prompt.trim() || undefined;
  const rule = AUTOMATION_PLACE_RULES[values.place];
  // A place whose host does not run the session (a cloud) starts on a task, from a repository.
  if (rule.host !== 'runs' && (!prompt || !repository)) return null;
  const checkout = repository && {
    installationId: repository.installationId,
    githubRepoId: Number(repository.githubRepoId),
    baseBranch: repository.baseBranch,
  };
  if (isVendorPlace(values.place) && prompt && checkout) {
    return {
      cloud: {
        provider: values.place,
        checkout,
        prompt,
        ...(values.model ? { model: values.model } : {}),
      },
    };
  }
  const agent = agentFor(values.place, values.agent);
  const cloud = rule.host === 'starts';
  const common = {
    hostId: values.hostId,
    agent,
    launch: cloud ? { model: values.model } : hostLaunch(agent, values.model),
    prompt,
  };
  if (!checkout) return { session: { ...common, folder: HOST_HOME } };
  return {
    session: {
      ...common,
      checkouts: [checkout],
      cwdGithubRepoId: checkout.githubRepoId,
      ...(cloud ? { cloud: true } : {}),
    },
  };
}

/** A session the host runs: the model, and the default permission level where the agent takes one. */
function hostLaunch(agent: CodingAgentId, model: string | null) {
  return {
    model,
    ...(CODING_AGENTS[agent].launch.permission ? { permission: DEFAULT_SESSION_PERMISSION } : {}),
  };
}

export function asAgent(value: string): CodingAgentId | null {
  return isCodingAgentId(value) ? value : null;
}
