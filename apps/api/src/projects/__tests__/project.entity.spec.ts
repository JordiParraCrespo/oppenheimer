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
  it('starts un-archived', () => {
    const project = ProjectEntity.createNew(VALID);

    expect(project.archivedAt).toBeNull();
    expect(project.isArchived).toBe(false);
  });

  it('keeps the slug when the project is renamed', () => {
    // The slug is the project's stable handle; renaming is display only.
    const project = ProjectEntity.createNew(VALID);

    project.rename('XRP Mobile (v2)');

    expect(project.name).toBe('XRP Mobile (v2)');
    expect(project.slug).toBe('xrp-mobile');
  });

  it('offers no way to change the slug, and archives one way only', () => {
    // A slug setter would break every link to the project. `archive` exists and
    // has no counterpart: a retired slug is never reissued, so archiving is a
    // one-way door by construction.
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

  it('refuses a slug that is not lower-case kebab', () => {
    for (const slug of ['XRP Mobile', 'xrp_mobile', 'xrp--mobile', '-xrp', 'xrp-', '']) {
      expect(() => ProjectEntity.createNew({ ...VALID, slug })).toThrow(ArgumentInvalidException);
    }
    expect(ProjectEntity.createNew({ ...VALID, slug: 'client-sites-3f9a7b2c' }).slug).toBe(
      'client-sites-3f9a7b2c',
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

  it('hands out copies, so the list changes only through configure', () => {
    const project = ProjectEntity.createNew(VALID);

    project.repositories[0].baseBranch = 'hacked';

    expect(project.repositories[0].baseBranch).toBe('main');
  });
});
