import type { BranchEntity, RepositoryEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { toProjectRepositoryRows } from '../lib/project-rows';

/**
 * The project dialog's rows are keyed like the scope chip, so a repository
 * ticked here is the one the chip will hold; the same GitHub repository under
 * two installations is two rows.
 */
const repository = (githubRepoId: number, fullName: string) =>
  ({ githubRepoId, fullName, defaultBranch: 'main' }) as unknown as RepositoryEntity;
const branch = (name: string) => ({ name }) as unknown as BranchEntity;

describe('toProjectRepositoryRows', () => {
  it("keys each row by installation and repository, with the ticked ones' branches", () => {
    const rows = toProjectRepositoryRows(
      [
        { repository: repository(1, 'acme/api'), installationId: 'inst-a' },
        { repository: repository(1, 'acme/api'), installationId: 'inst-b' },
        { repository: repository(2, 'acme/web'), installationId: 'inst-a' },
      ],
      new Map([[1, [branch('main'), branch('dev')]]]),
    );

    expect(rows).toEqual([
      {
        id: 'inst-a:1',
        name: 'acme/api',
        defaultBranch: 'main',
        branches: [{ value: 'main' }, { value: 'dev' }],
      },
      {
        id: 'inst-b:1',
        name: 'acme/api',
        defaultBranch: 'main',
        branches: [{ value: 'main' }, { value: 'dev' }],
      },
      { id: 'inst-a:2', name: 'acme/web', defaultBranch: 'main', branches: [] },
    ]);
  });
});
