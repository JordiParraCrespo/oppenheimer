import type {
  HostEntity,
  ProjectEntity,
  StartTaskSessionInput,
  TaskEntity,
} from '@oppenheimer/frontend-consumer';
import { CODING_AGENTS, type CodingAgentId, isCodingAgentId } from '@oppenheimer/shared/agents';
import {
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
  /** The project repository's row id. */
  repositoryId: string;
  place: StartPlace;
  /** The host it runs on or starts from; unread at a vendor. */
  hostId: string;
  agent: CodingAgentId;
  /** At a vendor, one of the vendor's models; null is the vendor's own pick. */
  model: string | null;
}

/** The body Start session sends, without what the dialog itself adds. */
export type StartSessionBody =
  | Pick<Extract<StartTaskSessionInput, { session: unknown }>, 'session'>
  | Pick<Extract<StartTaskSessionInput, { cloud: unknown }>, 'cloud'>;

export function asPlace(value: string): StartPlace | null {
  return (AUTOMATION_PLACES as readonly string[]).includes(value) ? (value as StartPlace) : null;
}

/** The agent each place runs: Claude Code in its cloud, and whatever was picked on a host. */
export function agentFor(place: StartPlace, agent: CodingAgentId): CodingAgentId {
  return place === 'claude-cloud' ? 'claude-code' : agent;
}

/**
 * What the dialog opens with: the task's title and notes as the prompt, and the
 * project's defaults — its first default repository, its host while the
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
    repositoryId: repository?.id ?? '',
    place: 'host',
    hostId: host?.id ?? '',
    agent,
    model: defaultModelFor(agent),
  };
}

/**
 * The body the choices make: the one repository on its base branch, and
 * - on a host, the launch New session would send for this agent unpicked —
 *   full permission where the agent takes one, the CLI's own effort;
 * - in Claude Code's cloud, New session's `cloud: true` body from the host,
 *   on a task (the cloud takes no permission level);
 * - at a vendor, `POST /sessions/cloud`'s body, on a task, with no host.
 * Null when the repository is gone, or a cloud place has no task to start on.
 */
export function toStartSession(
  values: StartSessionValues,
  project: ProjectEntity,
): StartSessionBody | null {
  const repository = project.repositories.find((row) => row.id === values.repositoryId);
  if (!repository) return null;
  const githubRepoId = Number(repository.githubRepoId);
  const checkout = {
    installationId: repository.installationId,
    githubRepoId,
    baseBranch: repository.baseBranch,
  };
  const prompt = values.prompt.trim() || undefined;
  if (values.place !== 'host' && !prompt) return null;
  if (isVendorPlace(values.place) && prompt) {
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
  const cloud = values.place === 'claude-cloud';
  return {
    session: {
      hostId: values.hostId,
      agent,
      checkouts: [checkout],
      cwdGithubRepoId: githubRepoId,
      ...(cloud ? { cloud: true } : {}),
      launch: {
        model: values.model,
        ...(!cloud && CODING_AGENTS[agent].launch.permission
          ? { permission: 'full' as const }
          : {}),
      },
      prompt,
    },
  };
}

export function asAgent(value: string): CodingAgentId | null {
  return isCodingAgentId(value) ? value : null;
}
