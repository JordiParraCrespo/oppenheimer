import { repositoryKey } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { toProjectRepositoryInputs } from '../lib/project-rows';

/** What the project dialog sends (`product/versions/mvp/05-screens.md`). */
describe('toProjectRepositoryInputs', () => {
  const id = repositoryKey({ installationId: 'inst-1', githubRepoId: 2 });

  it('sends every row with its base, the repository’s own default when none was picked', () => {
    const defaults = new Map([[id, 'main']]);
    expect(toProjectRepositoryInputs([{ id, isDefault: true, branch: '' }], defaults)).toEqual([
      { installationId: 'inst-1', githubRepoId: 2, isDefault: true, baseBranch: 'main' },
    ]);
    expect(
      toProjectRepositoryInputs([{ id, isDefault: false, branch: 'develop' }], defaults),
    ).toEqual([
      { installationId: 'inst-1', githubRepoId: 2, isDefault: false, baseBranch: 'develop' },
    ]);
  });

  it('drops a row whose id names nothing this screen knows', () => {
    expect(
      toProjectRepositoryInputs([{ id: 'garbage', isDefault: true, branch: '' }], new Map()),
    ).toEqual([]);
  });
});
