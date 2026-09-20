import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectUsageRegistry } from '../../../application/project-usage.registry';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import { ProjectEntity } from '../../../domain/project.entity';
import { ArchiveProjectCommand } from '../archive-project.command';
import { ArchiveProjectCommandHandler } from '../archive-project.command-handler';

/**
 * Archiving is the destructive path in this module, and the whole of its design is
 * that it **fails closed**: it asks whoever contributed an answer whether any work
 * is still going on inside the project's directory, and refuses if nothing did.
 * That refusal is a DI fact — an empty registry — rather than a caught exception,
 * which is what these tests pin.
 *
 * The lock that serialises this against creating a session lives in the repository,
 * where the transaction is; this is the layer that proves the handler asks the
 * question inside it and reports each outcome as itself.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function project(archivedAt: Date | null = null) {
  const entity = ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'xrp-mobile',
    slug: 'xrp-mobile',
    originGithubRepoId: '42',
  });
  if (archivedAt) entity.archive(archivedAt);
  return entity;
}

describe('ArchiveProjectCommandHandler', () => {
  let projects: ProjectRepositoryPort;
  let usage: ProjectUsageRegistry;
  let hasUnresolvedSessions: ReturnType<typeof vi.fn>;
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
    // A deployment built without the module that owns sessions. Nothing is
    // registered, so there is no implementation and the archive refuses — rather
    // than assuming the answer it would prefer on a destructive path.
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

  it('archives twice with the same outcome', async () => {
    vi.mocked(projects.archiveIfUnused).mockResolvedValue({
      result: 'archived',
      project: project(new Date()),
    });

    const archived = await handler.execute(command());
    expect(archived.isArchived).toBe(true);
  });

  it('reports a project it cannot see as missing', async () => {
    vi.mocked(projects.archiveIfUnused).mockResolvedValue({ result: 'not-found' });

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });
});
