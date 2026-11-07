import type { CodingAgentId } from '../agents/catalog.js';

/**
 * The body of `POST /sessions` a client of the API builds from what a person
 * or an agent asked for: a project's repository or a folder on a host. The
 * clients resolve names to ids their own way (`opp` by name, the MCP server
 * by id); what they send, and the defaults it takes, are decided here once.
 */

/** A repository as `GET /projects` lists it, narrowed to what a launch reads. */
export interface ProjectRepositoryView {
  installationId: string;
  /** GitHub's id; the API sends it as a string, a create takes a number. */
  githubRepoId: string | number;
  repositoryFullName: string;
  baseBranch: string;
  isDefault: boolean;
}

/** One repository to check out: our installation row, GitHub's id, the branch to cut from. */
export interface LaunchCheckout {
  installationId: string;
  githubRepoId: number;
  baseBranch: string;
  fullName: string;
}

/**
 * The repository `owner/name` names among a project's, compared without case,
 * or the project's default one (its first, if none is marked) when no name is
 * given; null when there is no such repository.
 */
export function pickProjectCheckout(
  repositories: readonly ProjectRepositoryView[],
  fullName?: string,
): LaunchCheckout | null {
  const wanted = fullName?.toLowerCase();
  const found = wanted
    ? repositories.find((repository) => repository.repositoryFullName.toLowerCase() === wanted)
    : (repositories.find((repository) => repository.isDefault) ?? repositories[0]);
  if (!found) return null;
  return {
    installationId: found.installationId,
    githubRepoId: Number(found.githubRepoId),
    baseBranch: found.baseBranch,
    fullName: found.repositoryFullName,
  };
}

export interface SessionLaunchInput {
  hostId: string;
  task: string;
  /** Exactly one of `checkout` and `folder`. */
  checkout?: LaunchCheckout;
  folder?: string;
  agent?: CodingAgentId;
  projectId?: string;
  name?: string;
  permission?: 'ask' | 'auto' | 'full';
  model?: string;
}

/**
 * `POST /sessions`'s body: the task as the first prompt, and the agent started
 * in the one checkout (or the folder). Claude Code when no agent is named;
 * the launch is sent only when it says something, so the API's own defaults
 * (`ask` for an agent with approvals) hold otherwise.
 */
export function sessionLaunchBody(input: SessionLaunchInput): Record<string, unknown> {
  const launch =
    input.permission || input.model
      ? { launch: { permission: input.permission, model: input.model } }
      : {};
  const place = input.folder
    ? { folder: input.folder }
    : input.checkout
      ? {
          checkouts: [
            {
              installationId: input.checkout.installationId,
              githubRepoId: input.checkout.githubRepoId,
              baseBranch: input.checkout.baseBranch,
            },
          ],
          cwdGithubRepoId: input.checkout.githubRepoId,
        }
      : {};
  return {
    hostId: input.hostId,
    agent: input.agent ?? 'claude-code',
    projectId: input.projectId,
    name: input.name,
    prompt: input.task,
    ...place,
    ...launch,
  };
}
