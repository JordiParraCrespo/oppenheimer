import { repositoryKey } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { toProjectRepositoryInputs } from '../lib/project-rows';

/** What the project page sends (`product/versions/mvp/12-projects-on-the-console.md`). */
describe('toProjectRepositoryInputs', () => {
  const id = repositoryKey({ installationId: 'inst-1', githubRepoId: 2 });

  it('sends a base branch only when it is not the repository’s own default', () => {
    const defaults = new Map([[id, 'main']]);
    expect(toProjectRepositoryInputs([{ id, isDefault: true, branch: 'main' }], defaults)).toEqual([
      { installationId: 'inst-1', githubRepoId: 2, isDefault: true },
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
