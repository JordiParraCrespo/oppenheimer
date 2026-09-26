import type { BranchEntity, RepositoryEntity } from '@oppenheimer/frontend-consumer';
import type { CreateProjectDto } from '@oppenheimer/shared/schemas/project';
import { repositoryKey } from './session-options';

/**
 * The project dialog's shapes. A repository row is keyed like the repository
 * chip's (`<installationId>:<githubRepoId>`), so one repository reads as the
 * same row in both pickers.
 */

/** A repository the dialog can offer: the row, and the ids the API is sent. */
export interface ProjectRepositoryOption {
  id: string;
  installationId: string;
  githubRepoId: number;
  name: string;
  defaultBranch: string;
  branches: readonly BranchEntity[];
}

/** Every connected installation's repositories, with the branches read so far. */
export function toProjectRepositoryOptions(
  repositories: readonly { repository: RepositoryEntity; installationId: string }[],
  branches: ReadonlyMap<number, readonly BranchEntity[]>,
): ProjectRepositoryOption[] {
  return repositories.map(({ repository, installationId }) => ({
    id: repositoryKey({ installationId, githubRepoId: repository.githubRepoId }),
    installationId,
    githubRepoId: repository.githubRepoId,
    name: repository.name,
    defaultBranch: repository.defaultBranch,
    branches: branches.get(repository.githubRepoId) ?? [],
  }));
}

/** The options as `RepositoryRowList` rows. */
export function toProjectRepositoryRows(options: readonly ProjectRepositoryOption[]) {
  return options.map((option) => ({
    id: option.id,
    name: option.name,
    defaultBranch: option.defaultBranch,
    branches: option.branches.map((branch) => ({ value: branch.name })),
  }));
}

/** The form's value as `RepositoryRowList` rows, in the project's order. */
export function toProjectRepositoryValue(value: CreateProjectDto['repositories']) {
  return value.map((repository) => ({
    id: repositoryKey(repository),
    isDefault: repository.isDefault,
    branch: repository.baseBranch,
  }));
}
