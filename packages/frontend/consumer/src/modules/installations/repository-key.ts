/**
 * How the console names one repository across installations.
 *
 * `githubRepoId` alone is not unique across two installations of the App,
 * and a picker's rows, a project's rows and a checkout each need one string
 * — so a repository is keyed by the pair, and the pair is what is parsed
 * back out when a session or a project is created.
 */

/** A repository as the console holds it: our installation row plus GitHub's id. */
export interface RepositoryRef {
  installationId: string;
  githubRepoId: number;
}

/**
 * The key: `<installationId>:<githubRepoId>`. The id comes as a number off
 * the installation listing and as a string off a project row or a checkout
 * (the column is a bigint); the key is the same either way.
 */
export function repositoryKey(ref: {
  installationId: string;
  githubRepoId: number | string;
}): string {
  return `${ref.installationId}:${ref.githubRepoId}`;
}

/** The pair a key names, or null when it names nothing the console knows. */
export function parseRepositoryKey(key: string): RepositoryRef | null {
  const separator = key.lastIndexOf(':');
  if (separator < 1) return null;
  const githubRepoId = Number(key.slice(separator + 1));
  if (!Number.isInteger(githubRepoId) || githubRepoId <= 0) return null;
  return { installationId: key.slice(0, separator), githubRepoId };
}
