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
  let projects: Pick<ProjectRepositoryPort, 'findOneById' | 'save'>;
  let handler: UpdateProjectCommandHandler;
  let project: ProjectEntity;

  beforeEach(() => {
    project = ProjectEntity.createNew({
      organizationId: 'org-acme',
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
      originGithubRepoId: 42,
    });
    projects = {
      findOneById: vi.fn().mockResolvedValue(Some(project)),
      save: vi.fn(async (entity: ProjectEntity) => entity),
    };
    handler = new UpdateProjectCommandHandler(projects as ProjectRepositoryPort);
  });

  const command = () =>
    new UpdateProjectCommand({ scope, projectId: project.id, name: 'XRP Mobile' });

  it('renames the project and returns its id', async () => {
    const id = await handler.execute(command());

    expect(id).toBe(project.id);
    expect(project.name).toBe('XRP Mobile');
    expect(projects.save).toHaveBeenCalledWith(project);
  });

  it('leaves the slug alone', async () => {
    await handler.execute(command());

    expect(project.slug).toBe('xrp-mobile');
  });

  it('loads through the caller’s scope, so another workspace’s project is not found', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(AppError);
    expect(projects.findOneById).toHaveBeenCalledWith(scope, project.id);
    expect(projects.save).not.toHaveBeenCalled();
  });
});
