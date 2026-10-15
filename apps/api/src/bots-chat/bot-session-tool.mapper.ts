import { createHash } from 'node:crypto';
import { type CreateSessionDto, createSessionSchema } from '@oppenheimer/shared';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import type { ProjectEntity } from '../projects/domain/project.entity';

/**
 * How `start_session`'s input becomes a session to create (`25-bots.md`
 * §4.2): the host (the one named, the project's default, the bot's home
 * host), the repository (the one named, or the project's default) or a folder,
 * and the body the sessions' own schema accepts; or, when one is missing or
 * wrong, the sentence that tells the model what to ask. Pure.
 */
export interface StartSessionInput {
  task: string;
  project_id?: string;
  repository?: string;
  folder?: string;
  host_id?: string;
  agent?: CodingAgentId;
  name?: string;
}

export function planSession(
  input: StartSessionInput,
  project: ProjectEntity | null,
  homeHostId: string | null,
): { body: CreateSessionDto; hostId: string } | { refusal: string } {
  if (!input.folder && !project) {
    return {
      refusal: 'Give a project_id (to work in one of its repositories) or a folder on the host.',
    };
  }
  const hostId = sessionHostId(input, project, homeHostId);
  if (!hostId) {
    return {
      refusal:
        'No host given, and neither the project nor you have a default one. Ask which host to use (list_hosts).',
    };
  }
  const checkout = input.folder ? null : pickRepository(project as ProjectEntity, input.repository);
  if (checkout && 'reason' in checkout) return { refusal: checkout.reason };
  const parsed = createSessionSchema.safeParse({
    hostId,
    agent: input.agent ?? project?.defaultAgent ?? 'claude-code',
    projectId: project?.id,
    name: input.name,
    prompt: input.task,
    ...(input.folder
      ? { folder: input.folder }
      : { checkouts: [checkout], cwdGithubRepoId: checkout?.githubRepoId }),
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'input');
    return {
      refusal: `Not started: the session would be invalid (${[...new Set(fields)].join(', ')}). Check the task, folder and name.`,
    };
  }
  return { body: parsed.data, hostId };
}

/** How much of the task a Needs input card shows. */
const TASK_IN_SUMMARY_MAX = 200;

/** The host a `start_session` call runs on: the one named, the project's default, the home host. */
export function sessionHostId(
  input: StartSessionInput,
  project: ProjectEntity | null,
  homeHostId: string | null,
): string | null {
  return input.host_id ?? project?.defaultHostId ?? homeHostId;
}

/**
 * The Needs input card's line for a `start_session` call: "Start Claude Code
 * on build-02 in acme/xrp-mobile: Fix the failing test", the task cut to
 * fit. `hostName` is the host as the owner sees it, or null when none is set.
 */
export function sessionSummary(
  input: StartSessionInput,
  project: ProjectEntity | null,
  hostName: string | null,
): string {
  const id = input.agent ?? project?.defaultAgent;
  const agent: CodingAgentId = CODING_AGENT_IDS.find((known) => known === id) ?? 'claude-code';
  const repository = project && !input.folder ? repositoryOf(project, input.repository) : null;
  const where = input.folder ? ` in ${input.folder}` : repository ? ` in ${repository}` : '';
  const task = input.task.replace(/\s+/g, ' ').trim();
  const clipped =
    task.length > TASK_IN_SUMMARY_MAX ? `${task.slice(0, TASK_IN_SUMMARY_MAX - 1)}…` : task;
  return `Start ${CODING_AGENTS[agent].label} on ${hostName ?? 'no host yet'}${where}: ${clipped}`;
}

function repositoryOf(project: ProjectEntity, name: string | undefined): string | null {
  const repositories = project.repositories;
  const chosen = name
    ? repositories.find((repo) => repo.repositoryFullName.toLowerCase() === name.toLowerCase())
    : (repositories.find((repo) => repo.isDefault) ?? repositories[0]);
  return chosen?.repositoryFullName ?? null;
}

/** The project's repository to check out: the one named, or its default. */
function pickRepository(
  project: ProjectEntity,
  name: string | undefined,
): { installationId: string; githubRepoId: number; baseBranch: string } | { reason: string } {
  const repositories = project.repositories;
  const chosen = name
    ? repositories.find((repo) => repo.repositoryFullName.toLowerCase() === name.toLowerCase())
    : (repositories.find((repo) => repo.isDefault) ?? repositories[0]);
  if (!chosen) {
    const names = repositories.map((repo) => repo.repositoryFullName).join(', ') || 'none';
    return {
      reason: name
        ? `The project has no repository ${name}. Its repositories: ${names}.`
        : 'The project has no repository. Use a folder, or ask the person to add one to the project.',
    };
  }
  return {
    installationId: chosen.installationId,
    githubRepoId: Number(chosen.githubRepoId),
    baseBranch: chosen.baseBranch,
  };
}

/**
 * The same call in the same turn starts one session, however often the model
 * repeats it; an approved call starts one per approval, however often its job
 * is retried.
 */
export function idempotencyKeyOf(
  turnId: string,
  body: CreateSessionDto,
  approvalId?: string,
): string {
  if (approvalId) return `bot:approval:${approvalId}`;
  const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
  return `bot:${turnId}:${digest}`;
}
