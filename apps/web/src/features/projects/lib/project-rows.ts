import type { RepositoryRowOption } from '@oppenheimer/design-system-web';
import {
  type BranchEntity,
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
