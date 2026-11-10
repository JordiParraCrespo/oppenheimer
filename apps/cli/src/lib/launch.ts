import type { CodingAgentId } from '@oppenheimer/shared/agents';
import { type LaunchCheckout, sessionLaunchBody } from '@oppenheimer/shared/sessions';
import type { Host, Project } from './api-types';
import type { ApiClient } from './client';
import { CliError, ExitCode } from './errors';
import { warn } from './output';
import { pickProjectRepository, resolveHost, resolveProject, resolveRepository } from './resolve';

/**
 * `opp sessions run`, from what was typed to `POST /sessions`: the names
 * (host, project, `owner/name`) resolved to ids here, and the body built by
 * `sessionLaunchBody` (`@oppenheimer/shared/sessions`), which the MCP
 * server's `start_session` builds with too.
 */

export interface LaunchOptions {
  host?: string;
  repo?: string;
  project?: string;
  base?: string;
  folder?: string;
  agent?: CodingAgentId;
  permission?: 'ask' | 'auto' | 'full';
  model?: string;
  name?: string;
  hidden?: boolean;
}

export interface LaunchPlan {
  host: Host;
  /** Where the agent works, as a person reads it: `owner/name` or the folder. */
  where: string;
  body: Record<string, unknown>;
}

export async function planLaunch(
  client: ApiClient,
  options: LaunchOptions,
  task: string,
): Promise<LaunchPlan> {
  if (options.folder && options.repo) {
    throw new CliError('Pass --folder or --repo, not both.', ExitCode.USAGE);
  }
  const project = options.project ? await resolveProject(client, options.project) : undefined;
  const checkout = options.folder
    ? undefined
    : await checkoutFor(client, project, options.repo, options.base);

  const hostNeedle = options.host ?? project?.defaultHostId ?? undefined;
  if (!hostNeedle) {
    throw new CliError(
      'Say which host to run on: --host <name>.',
      ExitCode.USAGE,
      '`opp hosts list` shows your hosts.',
    );
  }
  const host = await resolveHost(client, hostNeedle);
  if (!host.online) warn(`${host.name} is offline; the session will start when it comes back.`);

  return {
    host,
    where: options.folder ?? checkout?.fullName ?? '',
    body: sessionLaunchBody({
      hostId: host.id,
      task,
      checkout,
      folder: options.folder,
      agent: options.agent ?? project?.defaultAgent ?? undefined,
      projectId: project?.id ?? checkout?.projectId,
      name: options.name,
      permission: options.permission,
      model: options.model,
      hidden: options.hidden,
    }),
  };
}

/** The repository the agent checks out: the project's, when it holds the one named, else any installation's. */
async function checkoutFor(
  client: ApiClient,
  project: Project | undefined,
  repo: string | undefined,
  base: string | undefined,
): Promise<LaunchCheckout & { projectId?: string }> {
  const inProject =
    project &&
    (!repo ||
      project.repositories.some(
        (repository) => repository.repositoryFullName.toLowerCase() === repo.toLowerCase(),
      ));
  if (inProject) {
    const checkout = pickProjectRepository(project, repo);
    return base ? { ...checkout, baseBranch: base } : checkout;
  }
  if (repo) return resolveRepository(client, repo, base);
  throw new CliError(
    'Say where the agent works: --repo owner/name, --project, or --folder.',
    ExitCode.USAGE,
  );
}
