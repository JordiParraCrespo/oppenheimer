import { repositoryKey } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { projectBlock, projectInputOf } from '../lib/project-draft';

const row = (id: string, isDefault: boolean) => ({ id, isDefault, branch: 'main' });

describe('projectBlock', () => {
  it('asks for a name first, then a repository, then a default', () => {
    expect(projectBlock('  ', [])).toBe('name');
    expect(projectBlock('XRP', [])).toBe('repositories');
    expect(projectBlock('XRP', [row('a', false)])).toBe('default');
  });

  it('is ready once a named project holds a default repository', () => {
    expect(projectBlock('XRP', [row('a', true), row('b', false)])).toBeNull();
  });
});

/** What the project dialog sends (`product/versions/mvp/05-screens.md`). */
describe('projectInputOf', () => {
  const id = repositoryKey({ installationId: 'inst-1', githubRepoId: 2 });
  const values = (rows: { id: string; isDefault: boolean; branch: string }[]) => ({
    name: ' XRP ',
    rows,
    defaultHostId: null,
    defaultAgent: null,
  });

  it('sends the trimmed name and every row with its base', () => {
    expect(projectInputOf(values([{ id, isDefault: false, branch: 'develop' }]))).toEqual({
      name: 'XRP',
      repositories: [
        { installationId: 'inst-1', githubRepoId: 2, isDefault: false, baseBranch: 'develop' },
      ],
      defaultHostId: null,
      defaultAgent: null,
    });
  });

  it('drops a row whose id names nothing this screen knows', () => {
    expect(
      projectInputOf(values([{ id: 'garbage', isDefault: true, branch: 'main' }])).repositories,
    ).toEqual([]);
  });

  it('sends neither the name nor an empty list for Unassigned', () => {
    expect(projectInputOf(values([]), { fixed: true })).toEqual({
      defaultHostId: null,
      defaultAgent: null,
    });
  });
});
