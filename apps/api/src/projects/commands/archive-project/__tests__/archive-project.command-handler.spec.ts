import { QueryHandlerNotFoundException } from '@nestjs/cqrs/dist/exceptions';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import { ProjectEntity } from '../../../domain/project.entity';
import { ArchiveProjectCommand } from '../archive-project.command';
import { ArchiveProjectCommandHandler } from '../archive-project.command-handler';

/**
 * Archiving is the destructive path in this module, and the whole of its design is
 * that it **fails closed**: it asks the module that owns sessions whether any work
 * is still going on inside the project's directory, and refuses if nothing can
 * answer. A placeholder answering "no sessions" would be fail-open, which is why
 * archiving ships with the sessions slice rather than with this one.
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
  let queryBus: { execute: ReturnType<typeof vi.fn> };
  let handler: ArchiveProjectCommandHandler;

  beforeEach(() => {
    projects = {
      findOneById: vi.fn().mockResolvedValue(Some(project())),
      archiveIfActive: vi
        .fn()
        .mockImplementation(async (_scope, entity: ProjectEntity) => Some(entity)),
    } as unknown as ProjectRepositoryPort;
    queryBus = { execute: vi.fn().mockResolvedValue(false) };
    handler = new ArchiveProjectCommandHandler(
      projects,
      queryBus as unknown as ConstructorParameters<typeof ArchiveProjectCommandHandler>[1],
    );
  });

  const command = () => new ArchiveProjectCommand({ scope: SCOPE, projectId: 'project-1' });

  it('retires a project nothing is still working in', async () => {
    const archived = await handler.execute(command());
    expect(archived.isArchived).toBe(true);
    expect(projects.archiveIfActive).toHaveBeenCalledOnce();
  });

  it('refuses while the project still has open sessions', async () => {
    queryBus.execute.mockResolvedValue(true);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_005' });
    expect(projects.archiveIfActive).not.toHaveBeenCalled();
  });

  it('refuses when nothing can answer the question', async () => {
    // A build without the sessions module: the bus throws, and the archive refuses
    // rather than assuming the answer it would prefer.
    queryBus.execute.mockRejectedValue(new QueryHandlerNotFoundException('HasOpenSessionsQuery'));

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_003' });
    expect(projects.archiveIfActive).not.toHaveBeenCalled();
  });

  it('lets any other failure through rather than reporting it as unavailable', async () => {
    queryBus.execute.mockRejectedValue(new Error('the database fell over'));
    await expect(handler.execute(command())).rejects.toThrow('the database fell over');
  });

  it('archives twice with the same outcome', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(Some(project(new Date())));

    const archived = await handler.execute(command());
    expect(archived.isArchived).toBe(true);
    // Already retired: nothing to ask and nothing to write, and a retried request
    // after a lost response is not a conflict.
    expect(queryBus.execute).not.toHaveBeenCalled();
    expect(projects.archiveIfActive).not.toHaveBeenCalled();
  });

  it('reports a project it cannot see as missing', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });
});
