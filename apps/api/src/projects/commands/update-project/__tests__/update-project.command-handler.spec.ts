import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import { ProjectEntity } from '../../../domain/project.entity';
import { UpdateProjectCommand } from '../update-project.command';
import { UpdateProjectCommandHandler } from '../update-project.command-handler';

const scope: AccessScope = {
  userId: 'member-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('UpdateProjectCommandHandler', () => {
  let projects: Pick<ProjectRepositoryPort, 'findOneById' | 'renameIfActive'>;
  let handler: UpdateProjectCommandHandler;
  let project: ProjectEntity;

  beforeEach(() => {
    project = ProjectEntity.createNew({
      organizationId: 'org-acme',
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
      originGithubRepoId: '821374923',
    });
    projects = {
      findOneById: vi.fn().mockResolvedValue(Some(project)),
      renameIfActive: vi.fn(async (_scope: AccessScope, entity: ProjectEntity) => Some(entity)),
    };
    handler = new UpdateProjectCommandHandler(projects as ProjectRepositoryPort);
  });

  const command = () =>
    new UpdateProjectCommand({ scope, projectId: project.id, name: 'XRP Mobile' });

  it('renames the project and returns the stored aggregate', async () => {
    const renamed = await handler.execute(command());

    expect(renamed.id).toBe(project.id);
    expect(renamed.name).toBe('XRP Mobile');
    expect(projects.renameIfActive).toHaveBeenCalledWith(scope, project);
  });

  it('leaves the slug alone', async () => {
    expect((await handler.execute(command())).slug).toBe('xrp-mobile');
  });

  it('loads through the caller’s scope, so another workspace’s project is not found', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(AppError);
    expect(projects.findOneById).toHaveBeenCalledWith(scope, project.id);
    expect(projects.renameIfActive).not.toHaveBeenCalled();
  });

  it('does not resurrect a project the write found retired', async () => {
    // The row is the authority on whether the project is still active: the
    // targeted update matches nothing, and a rename must not report success —
    // nor write a stale `archivedAt` over an archive that landed meanwhile.
    vi.mocked(projects.renameIfActive).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });
});
