import type {
  CreateSessionInput,
  HostEntity,
  ProjectEntity,
  TaskEntity,
} from '@oppenheimer/frontend-consumer';
import { CODING_AGENTS, type CodingAgentId, isCodingAgentId } from '@oppenheimer/shared/agents';
import { defaultModelFor } from './agent-options';

/** The Start session dialog's choices (`18-plan-product.md` §4). */
export interface StartSessionValues {
  prompt: string;
  /** The project repository's row id. */
  repositoryId: string;
  hostId: string;
  agent: CodingAgentId;
  model: string | null;
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
    hostId: host?.id ?? '',
    agent,
    model: defaultModelFor(agent),
  };
}

/**
 * The New session body the choices make: the one repository on its base branch,
 * and the launch New session would send for this agent unpicked — full
 * permission where the agent takes one, the CLI's own effort.
 */
export function toStartSession(
  values: StartSessionValues,
  project: ProjectEntity,
): Omit<CreateSessionInput, 'projectId'> | null {
  const repository = project.repositories.find((row) => row.id === values.repositoryId);
  if (!repository) return null;
  const githubRepoId = Number(repository.githubRepoId);
  return {
    hostId: values.hostId,
    agent: values.agent,
    checkouts: [
      {
        installationId: repository.installationId,
        githubRepoId,
        baseBranch: repository.baseBranch,
      },
    ],
    cwdGithubRepoId: githubRepoId,
    launch: {
      model: values.model,
      ...(CODING_AGENTS[values.agent].launch.permission ? { permission: 'full' as const } : {}),
    },
    prompt: values.prompt.trim() || undefined,
  };
}

export function asAgent(value: string): CodingAgentId | null {
  return isCodingAgentId(value) ? value : null;
}
