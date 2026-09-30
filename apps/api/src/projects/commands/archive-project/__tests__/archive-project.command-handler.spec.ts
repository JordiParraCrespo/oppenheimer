import type { AccessScope } from '@oppenheimer/backend-authz';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { ProjectUsageRegistry } from '../../../application/project-usage.registry';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import { ProjectEntity } from '../../../domain/project.entity';
import { ArchiveProjectCommand } from '../archive-project.command';
import { ArchiveProjectCommandHandler } from '../archive-project.command-handler';

/**
 * Archiving fails closed: it asks whoever contributed an answer whether work is still
 * listed in the project and refuses if nothing did, an empty registry rather than a
 * caught exception. The lock that serialises this against creating a session is the
 * repository's; these tests prove the handler asks inside it and reports each outcome.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function project() {
  return ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'xrp-mobile',
    slug: 'xrp-mobile',
    repositories: [
      {
        installationId: 'installation-1',
        githubRepoId: '42',
        repositoryFullName: 'acme/xrp-mobile',
        baseBranch: 'main',
        isDefault: true,
      },
    ],
  });
}

describe('ArchiveProjectCommandHandler', () => {
  let projects: ProjectRepositoryPort;
  let usage: ProjectUsageRegistry;
  let hasUnresolvedSessions: Mock<(scope: AccessScope, projectId: string) => Promise<boolean>>;
  let handler: ArchiveProjectCommandHandler;

  beforeEach(() => {
    // The repository's contract is "lock, ask, write": the double honours it by
    // calling the question the handler passed in, so a handler that stopped asking
    // would fail here.
    projects = {
      archiveIfUnused: vi
        .fn()
        .mockImplementation(async (_scope, _id, stillInUse: () => Promise<boolean>) => {
          const entity = project();
          if (await stillInUse()) return { result: 'in-use', project: entity };
          entity.archive(new Date());
          return { result: 'archived', project: entity };
        }),
    } as unknown as ProjectRepositoryPort;

    hasUnresolvedSessions = vi.fn().mockResolvedValue(false);
    usage = new ProjectUsageRegistry();
    usage.register({ hasUnresolvedSessions });
    handler = new ArchiveProjectCommandHandler(projects, usage);
  });

  const command = () => new ArchiveProjectCommand({ scope: SCOPE, projectId: 'project-1' });

  it('retires a project nothing is still working in', async () => {
    const archived = await handler.execute(command());

    expect(archived.isArchived).toBe(true);
    expect(hasUnresolvedSessions).toHaveBeenCalledWith(SCOPE, 'project-1');
  });

  it('refuses while the project still has open sessions', async () => {
    hasUnresolvedSessions.mockResolvedValue(true);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_005' });
  });

  it('refuses when nothing has contributed an answer', async () => {
    // A deployment built without the module that owns sessions.
    handler = new ArchiveProjectCommandHandler(projects, new ProjectUsageRegistry());

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_003' });
    expect(projects.archiveIfUnused).not.toHaveBeenCalled();
  });

  it('lets a failure answering the question through rather than reporting it as unavailable', async () => {
    // "Nothing can answer" and "answering broke" are different faults, and only the
    // first is `PROJECTS_003`.
    hasUnresolvedSessions.mockRejectedValue(new Error('the database fell over'));

    await expect(handler.execute(command())).rejects.toThrow('the database fell over');
  });

  it.each([
    // A project the caller cannot see reads as missing.
    ['not-found', { result: 'not-found' } as const, 'PROJECTS_001'],
    ['unassigned', { result: 'unassigned', project: project() } as const, 'PROJECTS_008'],
  ])('reports a %s outcome as its own problem', async (_result, outcome, code) => {
    vi.mocked(projects.archiveIfUnused).mockResolvedValue(outcome);

    await expect(handler.execute(command())).rejects.toMatchObject({ code });
  });
});
