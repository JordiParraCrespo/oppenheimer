import { BranchEntity, RepositoryEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { fromRowValue, projectDraftGap, toRepositoryRows, toRowValue } from '../lib/project-rows';

const repository = (githubRepoId: number, fullName: string, defaultBranch = 'main') =>
  ({ githubRepoId, fullName, defaultBranch }) as RepositoryEntity;

describe('project rows', () => {
  it('keys a row by installation and repository, with the branches read so far', () => {
    const rows = toRepositoryRows(
      [
        { repository: repository(7, 'acme/xrp-mobile'), installationId: 'inst-1' },
        { repository: repository(8, 'acme/atlas', 'develop'), installationId: 'inst-2' },
      ],
      new Map([[7, [{ name: 'main' } as BranchEntity, { name: 'release' } as BranchEntity]]]),
    );

    expect(rows).toEqual([
      {
        id: 'inst-1:7',
        name: 'acme/xrp-mobile',
        defaultBranch: 'main',
        branches: [{ value: 'main' }, { value: 'release' }],
      },
      { id: 'inst-2:8', name: 'acme/atlas', defaultBranch: 'develop', branches: [] },
    ]);
  });

  it('turns rows into what the API takes, and back', () => {
    const options = toRepositoryRows(
      [{ repository: repository(8, 'acme/atlas', 'develop'), installationId: 'inst-2' }],
      new Map(),
    );
    const value = fromRowValue(
      [
        { id: 'inst-1:7', isDefault: true, branch: 'release' },
        // No branch yet: the repository's own default.
        { id: 'inst-2:8', isDefault: false, branch: '' },
        // An id that names nothing is dropped, not sent.
        { id: 'garbage', isDefault: true, branch: 'main' },
      ],
      options,
    );

    expect(value).toEqual([
      { installationId: 'inst-1', githubRepoId: 7, isDefault: true, baseBranch: 'release' },
      { installationId: 'inst-2', githubRepoId: 8, isDefault: false, baseBranch: 'develop' },
    ]);
    expect(toRowValue(value)).toEqual([
      { id: 'inst-1:7', isDefault: true, branch: 'release' },
      { id: 'inst-2:8', isDefault: false, branch: 'develop' },
    ]);
  });

  it('says what the draft is missing, in the order the page asks for it', () => {
    const held = {
      installationId: 'inst-1',
      githubRepoId: 7,
      isDefault: false,
      baseBranch: 'main',
    };
    expect(projectDraftGap({ name: ' ', repositories: [held] })).toBe('name');
    expect(projectDraftGap({ name: 'Mobile', repositories: [] })).toBe('repository');
    expect(projectDraftGap({ name: 'Mobile', repositories: [held] })).toBe('default');
    expect(projectDraftGap({ name: 'Mobile', repositories: [{ ...held, isDefault: true }] })).toBe(
      null,
    );
  });
});
