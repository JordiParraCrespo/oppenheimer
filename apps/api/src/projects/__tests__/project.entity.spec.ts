import { ArgumentInvalidException, ArgumentNotProvidedException } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { ProjectArchivedDomainEvent } from '../domain/events/project-archived.domain-event';
import { ProjectEntity } from '../domain/project.entity';

const VALID = { organizationId: 'org-1', name: 'xrp-mobile', slug: 'xrp-mobile' };

describe('ProjectEntity', () => {
  it('starts un-archived, with the origin repository recorded', () => {
    const project = ProjectEntity.createNew({ ...VALID, originGithubRepoId: 42 });

    expect(project.archivedAt).toBeNull();
    expect(project.isArchived).toBe(false);
    expect(project.originGithubRepoId).toBe(42);
  });

  it('defaults the origin to null rather than undefined', () => {
    expect(ProjectEntity.createNew(VALID).originGithubRepoId).toBeNull();
  });

  it('keeps the slug when the project is renamed', () => {
    // The whole point of splitting the two: the slug is a directory on every
    // host holding the project, so renaming must not touch it.
    const project = ProjectEntity.createNew(VALID);

    project.rename('XRP Mobile (v2)');

    expect(project.name).toBe('XRP Mobile (v2)');
    expect(project.slug).toBe('xrp-mobile');
  });

  it('offers no way to change the slug at all', () => {
    // Not a style point: a setter here would be a directory move on every host
    // with live sessions inside it.
    const descriptor = (name: string) =>
      Object.getOwnPropertyDescriptor(ProjectEntity.prototype, name);
    const methods = Object.getOwnPropertyNames(ProjectEntity.prototype).filter(
      (name) => typeof descriptor(name)?.value === 'function',
    );

    expect(descriptor('slug')?.get).toBeTypeOf('function');
    expect(descriptor('slug')?.set).toBeUndefined();
    expect(methods).toEqual(expect.arrayContaining(['rename', 'archive']));
    expect(methods.filter((name) => /slug/i.test(name))).toEqual([]);
  });

  it('archives by stamping a date and raising an event that names the slug', () => {
    const project = ProjectEntity.createNew(VALID);

    project.archive();

    expect(project.isArchived).toBe(true);
    expect(project.archivedAt).toBeInstanceOf(Date);
    const [event] = project.domainEvents;
    expect(event).toBeInstanceOf(ProjectArchivedDomainEvent);
    expect(event).toMatchObject({ organizationId: 'org-1', slug: 'xrp-mobile' });
  });

  it('archives idempotently, so a retry appends no second event', () => {
    const project = ProjectEntity.createNew(VALID);

    project.archive();
    const archivedAt = project.archivedAt;
    project.archive();

    expect(project.archivedAt).toBe(archivedAt);
    expect(project.domainEvents).toHaveLength(1);
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

  it('refuses a slug that is not a directory name', () => {
    for (const slug of ['XRP Mobile', 'xrp_mobile', 'xrp--mobile', '-xrp', 'xrp-', '']) {
      expect(() => ProjectEntity.createNew({ ...VALID, slug })).toThrow(ArgumentInvalidException);
    }
  });
});
