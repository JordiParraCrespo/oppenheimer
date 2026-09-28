import type { RepositoryRowOption, RepositoryRowValue } from '@oppenheimer/design-system-web';
import {
  type BranchEntity,
  type ProjectRepositoryInput,
  parseRepositoryKey,
  type RepositoryEntity,
  repositoryKey,
} from '@oppenheimer/frontend-consumer';

/**
 * The installations' repositories as the project dialog's rows, with the
 * branches of the ones already ticked. Keyed like the scope chip, so a row
 * ticked here is the same repository the chip will hold.
 */
export function toProjectRepositoryRows(
  repositories: readonly { repository: RepositoryEntity; installationId: string }[],
  branches: ReadonlyMap<number, readonly BranchEntity[]>,
): RepositoryRowOption[] {
  return repositories.map(({ repository, installationId }) => ({
    id: repositoryKey({ installationId, githubRepoId: repository.githubRepoId }),
    name: repository.fullName,
    defaultBranch: repository.defaultBranch,
    branches: (branches.get(repository.githubRepoId) ?? []).map((branch) => ({
      value: branch.name,
    })),
  }));
}

/**
 * The dialog's rows as `POST /projects` takes them. A row whose id no longer
 * parses is dropped rather than sent, for the same reason a checkout is.
 */
export function toProjectRepositoryInputs(
  rows: readonly RepositoryRowValue[],
  defaultBranches: ReadonlyMap<string, string> = new Map(),
): ProjectRepositoryInput[] {
  return rows.flatMap((row) => {
    const ref = parseRepositoryKey(row.id);
    if (!ref) return [];
    // Every row carries its base: the one picked, else the repository's own
    // default, which is what the row's pill shows until someone picks another.
    const baseBranch = row.branch || defaultBranches.get(row.id) || '';
    return [{ ...ref, isDefault: row.isDefault, baseBranch }];
  });
}
