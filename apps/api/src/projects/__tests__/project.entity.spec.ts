import { ArgumentInvalidException, ArgumentNotProvidedException } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { ProjectEntity } from '../domain/project.entity';

const REPOSITORIES = [
  {
    installationId: 'installation-1',
    githubRepoId: '42',
    repositoryFullName: 'acme/xrp-mobile',
    baseBranch: 'main',
    isDefault: true,
  },
];

const VALID = {
  organizationId: 'org-1',
  name: 'xrp-mobile',
  slug: 'xrp-mobile',
  repositories: REPOSITORIES,
};

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

describe('a project’s repositories and defaults', () => {
  const repo = (githubRepoId: string, isDefault = false) => ({
    installationId: 'installation-1',
    githubRepoId,
    repositoryFullName: `acme/repo-${githubRepoId}`,
    baseBranch: 'main',
    isDefault,
  });

  it('starts with no defaults and empty instructions', () => {
    const project = ProjectEntity.createNew(VALID);

    expect(project.defaultHostId).toBeNull();
    expect(project.defaultAgent).toBeNull();
    expect(project.instructions).toBe('');
    expect(project.createdByUserId).toBeNull();
  });

  it('refuses to be created holding no repository, or none offered by default', () => {
    expect(() => ProjectEntity.createNew({ ...VALID, repositories: [] })).toThrow(
      ArgumentInvalidException,
    );
    expect(() => ProjectEntity.createNew({ ...VALID, repositories: [repo('1')] })).toThrow(
      ArgumentInvalidException,
    );
  });

  it('refuses one repository twice and a blank base', () => {
    expect(() =>
      ProjectEntity.createNew({ ...VALID, repositories: [repo('1', true), repo('1')] }),
    ).toThrow(ArgumentInvalidException);
    expect(() =>
      ProjectEntity.createNew({
        ...VALID,
        repositories: [{ ...repo('1', true), baseBranch: '  ' }],
      }),
    ).toThrow(ArgumentInvalidException);
  });

  it('replaces the repositories as a set, and leaves the rest alone', () => {
    const project = ProjectEntity.createNew({ ...VALID, instructions: 'Run the tests.' });

    project.configure({ repositories: [repo('7'), repo('8', true)] });

    expect(project.repositories.map((repository) => repository.githubRepoId)).toEqual(['7', '8']);
    expect(project.instructions).toBe('Run the tests.');
    expect(project.slug).toBe('xrp-mobile');
  });

  it('refuses a set that would leave no default, and keeps the old one', () => {
    const project = ProjectEntity.createNew(VALID);

    expect(() => project.configure({ repositories: [repo('7')] })).toThrow(
      ArgumentInvalidException,
    );
    expect(project.repositories).toEqual(REPOSITORIES);
  });

  it('clears a default given null, and leaves it given nothing', () => {
    const project = ProjectEntity.createNew({
      ...VALID,
      defaultHostId: 'host-1',
      defaultAgent: 'codex',
    });

    project.configure({ defaultHostId: null });

    expect(project.defaultHostId).toBeNull();
    expect(project.defaultAgent).toBe('codex');
  });

  it('refuses instructions past the limit', () => {
    const project = ProjectEntity.createNew(VALID);

    expect(() => project.configure({ instructions: 'x'.repeat(8001) })).toThrow(
      ArgumentInvalidException,
    );
  });

  it('includes every repository it holds, and a session with none trivially', () => {
    const project = ProjectEntity.createNew({
      ...VALID,
      repositories: [repo('1', true), repo('2')],
    });

    expect(project.includesRepositories(['1', '2'])).toBe(true);
    expect(project.includesRepositories(['1', '3'])).toBe(false);
    expect(project.includesRepositories([])).toBe(true);
  });

  it('hands out copies, so the list changes only through configure', () => {
    const project = ProjectEntity.createNew(VALID);

    project.repositories[0].baseBranch = 'hacked';

    expect(project.repositories[0].baseBranch).toBe('main');
  });
});
