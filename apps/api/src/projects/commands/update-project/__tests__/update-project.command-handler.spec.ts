import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRepositoriesResolver } from '../../../application/project-repositories.resolver';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import { ProjectEntity } from '../../../domain/project.entity';
import { ProjectRepositoryEntity } from '../../../domain/project-repository.entity';
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
  let projects: Pick<ProjectRepositoryPort, 'findOneById' | 'saveIfActive'>;
  let resolver: Pick<ProjectRepositoriesResolver, 'assertHost' | 'resolveRepositories'>;
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
      saveIfActive: vi.fn(async (_scope: AccessScope, entity: ProjectEntity) => Some(entity)),
    };
    resolver = {
      assertHost: vi.fn().mockResolvedValue(undefined),
      resolveRepositories: vi.fn(
        async (_scope: AccessScope, rows: readonly { githubRepoId: number }[]) =>
          rows.map((row) =>
            ProjectRepositoryEntity.createNew({
              installationId: 'installation-1',
              githubRepoId: String(row.githubRepoId),
              fullName: `acme/repo-${row.githubRepoId}`,
            }),
          ),
      ),
    };
    handler = new UpdateProjectCommandHandler(
      projects as ProjectRepositoryPort,
      resolver as ProjectRepositoriesResolver,
    );
  });

  const command = (changes: UpdateProjectCommand['changes'] = { name: 'XRP Mobile' }) =>
    new UpdateProjectCommand({ scope, projectId: project.id, changes });

  it('renames the project and returns the stored aggregate', async () => {
    const renamed = await handler.execute(command());

    expect(renamed.id).toBe(project.id);
    expect(renamed.name).toBe('XRP Mobile');
    expect(projects.saveIfActive).toHaveBeenCalledWith(scope, project);
  });

  it('leaves the slug alone', async () => {
    expect((await handler.execute(command())).slug).toBe('xrp-mobile');
  });

  it('changes only what was given', async () => {
    // A rename must not clear the defaults, and a repository set given replaces
    // the old one; the host is confirmed only when a new one is named.
    project.change({ defaultHostId: 'host-1', defaultAgent: 'codex' });

    const saved = await handler.execute(
      command({
        repositories: [{ installationId: 'installation-1', githubRepoId: 7, isDefault: true }],
      }),
    );

    expect(saved.name).toBe('xrp-mobile');
    expect(saved.defaultHostId).toBe('host-1');
    expect(saved.defaultAgent).toBe('codex');
    expect(saved.repositories.map((repository) => repository.githubRepoId)).toEqual(['7']);
    expect(resolver.assertHost).toHaveBeenCalledWith(scope, undefined);
  });

  it('clears a default when told null, and confirms a new host', async () => {
    project.change({ defaultHostId: 'host-1' });

    const saved = await handler.execute(command({ defaultHostId: null, defaultAgent: null }));
    expect(saved.defaultHostId).toBeNull();

    await handler.execute(command({ defaultHostId: 'host-2' }));
    expect(resolver.assertHost).toHaveBeenLastCalledWith(scope, 'host-2');
  });

  it('loads through the caller’s scope, so another workspace’s project is not found', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(AppError);
    expect(projects.findOneById).toHaveBeenCalledWith(scope, project.id);
    expect(projects.saveIfActive).not.toHaveBeenCalled();
  });

  it('does not resurrect a project the write found retired', async () => {
    // The row is the authority on whether the project is still active: the
    // targeted update matches nothing, and a save must not report success —
    // nor write a stale `archivedAt` over an archive that landed meanwhile.
    vi.mocked(projects.saveIfActive).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });
});
