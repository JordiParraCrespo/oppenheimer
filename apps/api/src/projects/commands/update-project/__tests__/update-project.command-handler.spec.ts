import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectRepositoryInputDto } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSettingsResolver } from '../../../application/project-settings.resolver';
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

const XRP = {
  installationId: 'installation-1',
  githubRepoId: '42',
  repositoryFullName: 'acme/xrp-mobile',
  baseBranch: 'main',
  isDefault: true,
};

describe('UpdateProjectCommandHandler', () => {
  let projects: Pick<ProjectRepositoryPort, 'findOneById' | 'saveSettingsIfActive'>;
  let settings: Pick<ProjectSettingsResolver, 'repositories' | 'assertUsableHost'>;
  let handler: UpdateProjectCommandHandler;
  let project: ProjectEntity;

  beforeEach(() => {
    project = ProjectEntity.createNew({
      organizationId: 'org-acme',
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
      repositories: [XRP],
    });
    projects = {
      findOneById: vi.fn().mockResolvedValue(Some(project)),
      saveSettingsIfActive: vi.fn(async (_scope: AccessScope, entity: ProjectEntity) =>
        Some(entity),
      ),
    };
    settings = {
      repositories: vi.fn(
        async (_scope: AccessScope, inputs: readonly ProjectRepositoryInputDto[]) =>
          inputs.map((input) => ({
            installationId: input.installationId,
            githubRepoId: String(input.githubRepoId),
            repositoryFullName: `acme/repo-${input.githubRepoId}`,
            baseBranch: input.baseBranch,
            isDefault: input.isDefault,
          })),
      ),
      assertUsableHost: vi.fn(async () => undefined),
    };
    handler = new UpdateProjectCommandHandler(
      projects as ProjectRepositoryPort,
      settings as ProjectSettingsResolver,
    );
  });

  const command = (changes: UpdateProjectCommand['changes'] = { name: 'XRP Mobile' }) =>
    new UpdateProjectCommand({ scope, projectId: project.id, changes });

  it('renames the project and returns the stored aggregate', async () => {
    const renamed = await handler.execute(command());

    expect(renamed.id).toBe(project.id);
    expect(renamed.name).toBe('XRP Mobile');
    expect(projects.saveSettingsIfActive).toHaveBeenCalledWith(scope, project);
  });

  it('leaves the slug alone', async () => {
    expect((await handler.execute(command())).slug).toBe('xrp-mobile');
  });

  it('leaves absent fields as they are and clears a default given null', async () => {
    project.configure({ defaultAgent: 'codex', instructions: 'Run the tests.' });

    const saved = await handler.execute(command({ defaultAgent: null }));

    expect(saved.defaultAgent).toBeNull();
    expect(saved.instructions).toBe('Run the tests.');
    expect(saved.repositories).toEqual([XRP]);
    expect(settings.repositories).not.toHaveBeenCalled();
  });

  it('replaces the repositories as a set, resolved live, in the order given', async () => {
    const saved = await handler.execute(
      command({
        repositories: [
          {
            installationId: 'installation-1',
            githubRepoId: 7,
            baseBranch: 'dev',
            isDefault: false,
          },
          {
            installationId: 'installation-1',
            githubRepoId: 42,
            baseBranch: 'main',
            isDefault: true,
          },
        ],
      }),
    );

    expect(settings.repositories).toHaveBeenCalledTimes(1);
    expect(saved.repositories.map((repository) => repository.githubRepoId)).toEqual(['7', '42']);
    expect(saved.repositories[0].repositoryFullName).toBe('acme/repo-7');
  });

  it('checks a default host the caller names', async () => {
    await handler.execute(command({ defaultHostId: 'host-1' }));

    expect(settings.assertUsableHost).toHaveBeenCalledWith(scope, 'host-1');
  });

  it('loads through the caller’s scope, so another workspace’s project is not found', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(AppError);
    expect(projects.findOneById).toHaveBeenCalledWith(scope, project.id);
    expect(projects.saveSettingsIfActive).not.toHaveBeenCalled();
  });

  it('does not resurrect a project the write found retired', async () => {
    // The row is the authority on whether the project is still active: the
    // targeted update matches nothing, and a save must not report success —
    // nor write a stale `archivedAt` over an archive that landed meanwhile.
    vi.mocked(projects.saveSettingsIfActive).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });
});
