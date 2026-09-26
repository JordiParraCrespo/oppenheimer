import { ArgumentInvalidException, ArgumentNotProvidedException } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { ProjectEntity } from '../domain/project.entity';
import { ProjectRepositoryEntity } from '../domain/project-repository.entity';

const VALID = { organizationId: 'org-1', name: 'xrp-mobile', slug: 'xrp-mobile' };

describe('ProjectEntity', () => {
  it('starts un-archived, with the origin repository recorded as a string', () => {
    const project = ProjectEntity.createNew({ ...VALID, originGithubRepoId: '821374923' });

    expect(project.archivedAt).toBeNull();
    expect(project.isArchived).toBe(false);
    // A bigint id stays a string all the way through: it is not promised to fit
    // in a JavaScript number.
    expect(project.originGithubRepoId).toBe('821374923');
  });

  it('defaults the origin to null rather than undefined', () => {
    expect(ProjectEntity.createNew(VALID).originGithubRepoId).toBeNull();
  });

  it('keeps the slug when the project is renamed', () => {
    // The whole point of splitting the two: the slug is a directory on every host
    // holding the project, so renaming must not touch it.
    const project = ProjectEntity.createNew(VALID);

    project.rename('XRP Mobile (v2)');

    expect(project.name).toBe('XRP Mobile (v2)');
    expect(project.slug).toBe('xrp-mobile');
  });

  it('offers no way to change the slug, and archives one way only', () => {
    // A slug setter would be a directory move on every host with live work
    // inside it. `archive` exists and has no counterpart: a retired slug is never
    // reissued, so archiving is a one-way door by construction.
    const descriptor = (name: string) =>
      Object.getOwnPropertyDescriptor(ProjectEntity.prototype, name);
    const methods = Object.getOwnPropertyNames(ProjectEntity.prototype).filter(
      (name) => typeof descriptor(name)?.value === 'function',
    );

    expect(descriptor('slug')?.get).toBeTypeOf('function');
    expect(descriptor('slug')?.set).toBeUndefined();
    expect(methods).toEqual(expect.arrayContaining(['rename', 'archive']));
    expect(methods.filter((name) => /slug/i.test(name))).toEqual([]);
    expect(methods.filter((name) => /unarchive|restore|reopen/i.test(name))).toEqual([]);
  });

  it('refuses a project with no organization or no name', () => {
    expect(() => ProjectEntity.createNew({ ...VALID, organizationId: ' ' })).toThrow(
      ArgumentNotProvidedException,
    );
    expect(() => ProjectEntity.createNew({ ...VALID, name: '  ' })).toThrow(
      ArgumentNotProvidedException,
    );
    expect(() => ProjectEntity.createNew(VALID).rename('')).toThrow(ArgumentNotProvidedException);
  });

  it('refuses a slug that is not a directory name, and admits the owner--repo form', () => {
    for (const slug of ['XRP Mobile', 'xrp_mobile', 'xrp---mobile', '-xrp', 'xrp-', '']) {
      expect(() => ProjectEntity.createNew({ ...VALID, slug })).toThrow(ArgumentInvalidException);
    }
    expect(ProjectEntity.createNew({ ...VALID, slug: 'acme--xrp-mobile' }).slug).toBe(
      'acme--xrp-mobile',
    );
  });
});

describe('ProjectEntity: defaults and repositories', () => {
  const repo = (githubRepoId: string, isDefault = false) =>
    ProjectRepositoryEntity.createNew({
      installationId: 'installation-1',
      githubRepoId,
      fullName: `acme/repo-${githubRepoId}`,
      isDefault,
    });

  it('starts with no defaults and no repositories', () => {
    const project = ProjectEntity.createNew(VALID);
    expect(project.defaultHostId).toBeNull();
    expect(project.defaultAgent).toBeNull();
    expect(project.repositories).toEqual([]);
    expect(project.defaultRepositories).toEqual([]);
  });

  it('changes only the fields given, and keeps the slug', () => {
    const project = ProjectEntity.createNew(VALID);
    project.change({ defaultHostId: 'host-1', repositories: [repo('1'), repo('2', true)] });
    project.change({ name: 'XRP Mobile' });

    expect(project.name).toBe('XRP Mobile');
    expect(project.slug).toBe('xrp-mobile');
    expect(project.defaultHostId).toBe('host-1');
    expect(project.defaultRepositories.map((r) => r.githubRepoId)).toEqual(['2']);
    expect(project.includesRepository('1')).toBe(true);
    expect(project.includesRepository('9')).toBe(false);
  });

  it('refuses the same repository twice and an agent the catalog does not know', () => {
    const project = ProjectEntity.createNew(VALID);
    expect(() => project.change({ repositories: [repo('1'), repo('1')] })).toThrow(
      ArgumentInvalidException,
    );
    expect(() => project.change({ defaultAgent: 'vim' as unknown as 'claude-code' })).toThrow(
      ArgumentInvalidException,
    );
  });

  it('reads a repository’s owner and name off its full name', () => {
    const row = repo('5');
    expect(row.owner).toBe('acme');
    expect(row.name).toBe('repo-5');
    expect(row.baseBranch).toBeNull();
  });
});
