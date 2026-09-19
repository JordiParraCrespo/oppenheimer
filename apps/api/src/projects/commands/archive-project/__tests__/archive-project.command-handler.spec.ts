import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectUsagePort } from '../../../application/project-usage.port';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import { ProjectEntity } from '../../../domain/project.entity';
import { ArchiveProjectCommand } from '../archive-project.command';
import { ArchiveProjectCommandHandler } from '../archive-project.command-handler';

const scope: AccessScope = {
  userId: 'member-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('ArchiveProjectCommandHandler', () => {
  let projects: Pick<ProjectRepositoryPort, 'findOneById' | 'save'>;
  let usage: ProjectUsagePort;
  let handler: ArchiveProjectCommandHandler;
  let project: ProjectEntity;

  beforeEach(() => {
    project = ProjectEntity.createNew({
      organizationId: 'org-acme',
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
    });
    projects = {
      findOneById: vi.fn().mockResolvedValue(Some(project)),
      save: vi.fn(async (entity: ProjectEntity) => entity),
    };
    usage = { hasOpenSessions: vi.fn().mockResolvedValue(false) };
    handler = new ArchiveProjectCommandHandler(projects as ProjectRepositoryPort, usage);
  });

  const command = () => new ArchiveProjectCommand({ scope, projectId: project.id });

  it('archives the project, keeping the row and its slug', async () => {
    await handler.execute(command());

    expect(project.isArchived).toBe(true);
    expect(project.slug).toBe('xrp-mobile');
    expect(projects.save).toHaveBeenCalledWith(project);
  });

  it('refuses while the project has open sessions', async () => {
    // A refusal, not a cascade: the sessions own worktrees on a host.
    vi.mocked(usage.hasOpenSessions).mockResolvedValue(true);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_002' });
    expect(project.isArchived).toBe(false);
    expect(projects.save).not.toHaveBeenCalled();
  });

  it('asks about the project it actually loaded', async () => {
    await handler.execute(command());

    expect(usage.hasOpenSessions).toHaveBeenCalledWith(project.id);
  });

  it('reports a project outside the caller’s scope as missing', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
    expect(usage.hasOpenSessions).not.toHaveBeenCalled();
  });
});
