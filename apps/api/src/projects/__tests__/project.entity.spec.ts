import { ArgumentInvalidException, ArgumentNotProvidedException } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { ProjectEntity } from '../domain/project.entity';

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

  it('offers no way to change the slug, or to archive, at all', () => {
    // A slug setter would be a directory move on every host with live work
    // inside it; archiving arrives with the slice that can refuse it.
    const descriptor = (name: string) =>
      Object.getOwnPropertyDescriptor(ProjectEntity.prototype, name);
    const methods = Object.getOwnPropertyNames(ProjectEntity.prototype).filter(
      (name) => typeof descriptor(name)?.value === 'function',
    );

    expect(descriptor('slug')?.get).toBeTypeOf('function');
    expect(descriptor('slug')?.set).toBeUndefined();
    expect(methods).toEqual(expect.arrayContaining(['rename']));
    expect(methods.filter((name) => /slug|archive/i.test(name))).toEqual([]);
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
