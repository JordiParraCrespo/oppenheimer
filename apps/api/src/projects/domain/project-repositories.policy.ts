/**
 * What makes a project's repository list one a project can hold
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * Pure: the list in, the first thing wrong with it out, or `null`. The aggregate
 * refuses a list with a problem, and the handlers ask first so the caller gets the
 * problem document that names it rather than a generic invalid argument.
 */

/** How many repositories one project may hold. Kept equal to the shared schema's. */
export const MAX_PROJECT_REPOSITORIES = 20;

/** One repository a project holds. `githubRepoId` is the string a bigint travels as. */
export interface ProjectRepositoryProps {
  /** Our `github_installation` row's id. */
  installationId: string;
  githubRepoId: string;
  /** `owner/repo` as GitHub spelled it at the last write. Display only. */
  repositoryFullName: string;
  /** What a session's branch is created from when it takes this repository. */
  baseBranch: string;
  /** Offered to a new session. Never applied by the API. */
  isDefault: boolean;
}

export type ProjectRepositoriesProblem =
  | 'empty'
  | 'no-default'
  | 'duplicate'
  | 'too-many'
  | 'blank-base';

export function projectRepositoriesProblem(
  repositories: readonly ProjectRepositoryProps[],
): ProjectRepositoriesProblem | null {
  if (repositories.length === 0) return 'empty';
  if (repositories.length > MAX_PROJECT_REPOSITORIES) return 'too-many';
  if (
    new Set(repositories.map((repository) => repository.githubRepoId)).size !== repositories.length
  ) {
    return 'duplicate';
  }
  if (repositories.some((repository) => !repository.baseBranch.trim())) return 'blank-base';
  if (!repositories.some((repository) => repository.isDefault)) return 'no-default';
  return null;
}
