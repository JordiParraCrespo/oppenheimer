/**
 * A repository as the console holds it: our installation row plus GitHub's id.
 *
 * `githubRepoId` alone is not unique across two installations of the App, so a
 * picker row is keyed by the pair — `<installationId>:<githubRepoId>` — and the
 * pair is what is parsed back out when the row is sent. The New session chip
 * and the project page key their rows the same way, so one repository is the
 * same row in both.
 */
export interface RepositoryRef {
  installationId: string;
  githubRepoId: number;
}

/** The picker's row id: `<installationId>:<githubRepoId>`. */
export function repositoryKey(ref: RepositoryRef): string {
  return `${ref.installationId}:${ref.githubRepoId}`;
}

/** The pair a row id names, or null when it names nothing the console knows. */
export function parseRepositoryKey(key: string): RepositoryRef | null {
  const separator = key.lastIndexOf(':');
  if (separator < 1) return null;
  const githubRepoId = Number(key.slice(separator + 1));
  if (!Number.isInteger(githubRepoId) || githubRepoId <= 0) return null;
  return { installationId: key.slice(0, separator), githubRepoId };
}
