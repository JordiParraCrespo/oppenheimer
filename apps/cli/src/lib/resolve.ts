import type { Bot, Host, Installation, Project, Repository } from './api-types';
import type { ApiClient } from './client';
import { CliError, ExitCode } from './errors';

/**
 * Turning what a person types (`mac-studio`, `acme/app`, `Juno`) into the ids
 * the API takes. Matching is pure and exported for the tests; the lookups that
 * feed it are the thin async wrappers below.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Named {
  id: string;
  name: string;
}

/**
 * The one item an id or a name names. An id matches exactly; a name matches
 * case-insensitively, and two items with the same name are refused rather than
 * guessed between, because acting on the wrong host is worse than asking.
 */
export function pickByNameOrId<T extends Named>(
  items: readonly T[],
  needle: string,
  noun: string,
  listCommand: string,
): T {
  const wanted = needle.trim();
  if (UUID.test(wanted)) {
    const byId = items.find((item) => item.id === wanted);
    if (byId) return byId;
  }
  const lower = wanted.toLowerCase();
  const byName = items.filter((item) => item.name.toLowerCase() === lower);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new CliError(
      `${byName.length} ${noun}s are called "${wanted}".`,
      ExitCode.USAGE,
      `Pass the id instead (\`${listCommand}\`).`,
    );
  }
  throw new CliError(
    `No ${noun} "${wanted}".`,
    ExitCode.NOT_FOUND,
    `\`${listCommand}\` lists them.`,
  );
}

/** A repository as a session or an automation names it. */
export interface CheckoutRef {
  installationId: string;
  githubRepoId: number;
  baseBranch: string;
  fullName: string;
  /** The project that holds it, when it came from one. */
  projectId?: string;
}

/**
 * The repository `owner/name` names among a project's, or the project's
 * default one when no name is given.
 */
export function pickProjectRepository(project: Project, fullName?: string): CheckoutRef {
  const repositories = project.repositories;
  const found = fullName
    ? repositories.find(
        (repository) => repository.repositoryFullName.toLowerCase() === fullName.toLowerCase(),
      )
    : (repositories.find((repository) => repository.isDefault) ?? repositories[0]);
  if (!found) {
    throw new CliError(
      fullName
        ? `Project "${project.name}" has no repository ${fullName}.`
        : `Project "${project.name}" has no repositories.`,
      ExitCode.USAGE,
      'Pass --repo owner/name, or add the repository to the project in the console.',
    );
  }
  return {
    installationId: found.installationId,
    githubRepoId: Number(found.githubRepoId),
    baseBranch: found.baseBranch,
    fullName: found.repositoryFullName,
    projectId: project.id,
  };
}

/** The first project holding `owner/name`, preferring a named one over Unassigned. */
export function findRepositoryInProjects(
  projects: readonly Project[],
  fullName: string,
): CheckoutRef | null {
  const lower = fullName.toLowerCase();
  const holders = projects.filter((project) =>
    project.repositories.some(
      (repository) => repository.repositoryFullName.toLowerCase() === lower,
    ),
  );
  const project = holders.find((holder) => !holder.isUnassigned) ?? holders[0];
  return project ? pickProjectRepository(project, fullName) : null;
}

export async function resolveHost(client: ApiClient, needle: string): Promise<Host> {
  const hosts = await client.get<Host[]>('/hosts');
  return pickByNameOrId(hosts, needle, 'host', 'opp hosts list');
}

export async function resolveProject(client: ApiClient, needle: string): Promise<Project> {
  const projects = await client.get<Project[]>('/projects');
  return pickByNameOrId(projects, needle, 'project', 'opp projects list');
}

export async function resolveBot(client: ApiClient, needle: string): Promise<Bot> {
  const bots = await client.get<Bot[]>('/bots');
  return pickByNameOrId(bots, needle, 'bot', 'opp bots list');
}

/**
 * Where `owner/name` comes from: a project that holds it, else any connected
 * GitHub App installation that grants it (asked of GitHub live, so it is the
 * slower path and only taken when no project knows the repository).
 */
export async function resolveRepository(
  client: ApiClient,
  fullName: string,
  base?: string,
): Promise<CheckoutRef> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    throw new CliError(`"${fullName}" is not owner/name.`, ExitCode.USAGE);
  }
  const projects = await client.get<Project[]>('/projects');
  const fromProject = findRepositoryInProjects(projects, fullName);
  if (fromProject) return { ...fromProject, baseBranch: base ?? fromProject.baseBranch };

  const owner = fullName.split('/')[0].toLowerCase();
  const installations = (await client.get<Installation[]>('/installations')).filter(
    (installation) => !installation.suspendedAt,
  );
  // The installation on the repository's owner first: it is almost always the one.
  installations.sort(
    (a, b) =>
      Number(b.accountLogin.toLowerCase() === owner) -
      Number(a.accountLogin.toLowerCase() === owner),
  );
  for (const installation of installations) {
    const repositories = await client.get<Repository[]>(
      `/installations/${installation.id}/repositories`,
    );
    const found = repositories.find(
      (repository) => repository.fullName.toLowerCase() === fullName.toLowerCase(),
    );
    if (found) {
      return {
        installationId: installation.id,
        githubRepoId: found.githubRepoId,
        baseBranch: base ?? found.defaultBranch,
        fullName: found.fullName,
      };
    }
  }
  throw new CliError(
    `No connected GitHub installation grants ${fullName}.`,
    ExitCode.NOT_FOUND,
    'Install the GitHub App on it from the console (Settings → GitHub), or check the spelling.',
  );
}
