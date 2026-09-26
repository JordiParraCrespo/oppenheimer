import { describe, expect, it } from 'vitest';
import { ProjectEntity, shortName } from '../project.entity';

const repo = (githubRepoId: number, fullName: string, isDefault = false) => ({
  id: `row-${githubRepoId}`,
  installationId: 'inst-1',
  githubRepoId,
  fullName,
  isDefault,
  baseBranch: null,
});

const project = (repositories = [repo(1, 'acme/atlas'), repo(2, 'acme/xrp-mobile', true)]) =>
  new ProjectEntity(
    'p-1',
    'XRP Mobile',
    'xrp-mobile',
    null,
    null,
    null,
    repositories,
    new Date(),
    new Date(),
  );

describe('ProjectEntity', () => {
  it('lists the repositories every new session clones, in the order given', () => {
    expect(project().defaultRepositories.map((r) => r.fullName)).toEqual(['acme/xrp-mobile']);
    expect(project([]).defaultRepositories).toEqual([]);
  });

  it('says whether it holds a repository, by GitHub’s id', () => {
    expect(project().includesRepository(1)).toBe(true);
    expect(project().includesRepository(3)).toBe(false);
  });

  it('prints repositories by their own name', () => {
    expect(shortName('acme/xrp-mobile')).toBe('xrp-mobile');
    expect(shortName('xrp-mobile')).toBe('xrp-mobile');
    expect(project().shortName).toBe('atlas, xrp-mobile');
  });
});
