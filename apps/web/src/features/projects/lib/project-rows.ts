import type { RepositoryRowOption, RepositoryRowValue } from '@oppenheimer/design-system-web';
import {
  type BranchEntity,
  parseRepositoryKey,
  type RepositoryEntity,
  repositoryKey,
} from '@oppenheimer/frontend-consumer';
import type { CreateProjectDto } from '@oppenheimer/shared/schemas/project';

/**
 * The project page's shapes. Entities in, the design system's rows out, and
 * the rows back into what `POST /projects` takes. A row is keyed like New
 * session's repository chip (`<installationId>:<githubRepoId>`), so a
 * repository ticked here is the same row the chip will hold.
 */

/** The repositories the form holds, as the shared schema spells them. */
export type ProjectRepositoriesValue = CreateProjectDto['repositories'];

/**
 * Every connected installation's repositories as `RepositoryRowList` rows,
 * with the branches of the rows already ticked. A row's name is GitHub's full
 * name, as the list prints it in mono.
 */
export function toRepositoryRows(
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

/** The form's value as `RepositoryRowList` rows, in the project's order. */
export function toRowValue(value: ProjectRepositoriesValue): RepositoryRowValue[] {
  return value.map((repository) => ({
    id: repositoryKey(repository),
    isDefault: repository.isDefault,
    branch: repository.baseBranch,
  }));
}

/**
 * The list's rows as the form's value. A row whose id no longer parses is
 * dropped rather than sent: it would name a repository this workspace cannot
 * reach. A row with no branch yet takes its repository's default one, so every
 * row the API is sent carries a base.
 */
export function fromRowValue(
  rows: readonly RepositoryRowValue[],
  options: readonly RepositoryRowOption[],
): ProjectRepositoriesValue {
  return rows.flatMap((row) => {
    const ref = parseRepositoryKey(row.id);
    if (!ref) return [];
    const baseBranch =
      row.branch || options.find((option) => option.id === row.id)?.defaultBranch || '';
    return [{ ...ref, isDefault: row.isDefault, baseBranch }];
  });
}

/** Which of the page's three steps the draft is missing, first first. */
export type ProjectDraftGap = 'name' | 'repository' | 'default' | null;

/**
 * What still stands between the draft and Create project — the export's
 * recap line says it in words. `null` when nothing does.
 */
export function projectDraftGap(draft: {
  name: string;
  repositories: ProjectRepositoriesValue;
}): ProjectDraftGap {
  if (!draft.name.trim()) return 'name';
  if (draft.repositories.length === 0) return 'repository';
  if (!draft.repositories.some((repository) => repository.isDefault)) return 'default';
  return null;
}
