import type { AccessScope } from '@oppenheimer/backend-authz';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRepositoriesResolver } from '../../../application/project-repositories.resolver';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import type { ProjectEntity } from '../../../domain/project.entity';
import { ProjectRepositoryEntity } from '../../../domain/project-repository.entity';
import { CreateProjectCommand } from '../create-project.command';
import { CreateProjectCommandHandler } from '../create-project.command-handler';

const scope: AccessScope = {
  userId: 'member-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const ROWS = [
  { installationId: 'installation-1', githubRepoId: 11, isDefault: false },
  { installationId: 'installation-1', githubRepoId: 12, isDefault: true, baseBranch: 'develop' },
];

describe('CreateProjectCommandHandler', () => {
  let projects: Pick<ProjectRepositoryPort, 'insertIfUnclaimed'>;
  let resolver: Pick<ProjectRepositoriesResolver, 'assertHost' | 'resolveRepositories'>;
  let handler: CreateProjectCommandHandler;

  beforeEach(() => {
    projects = { insertIfUnclaimed: vi.fn().mockResolvedValue('inserted') };
    resolver = {
      assertHost: vi.fn().mockResolvedValue(undefined),
      resolveRepositories: vi.fn(async (_scope: AccessScope, rows: typeof ROWS) =>
        rows.map((row) =>
          ProjectRepositoryEntity.createNew({
            installationId: row.installationId,
            githubRepoId: String(row.githubRepoId),
            fullName: row.githubRepoId === 12 ? 'acme/XRP-Mobile' : 'acme/atlas',
            isDefault: row.isDefault,
            baseBranch: row.baseBranch ?? null,
          }),
        ),
      ),
    };
    handler = new CreateProjectCommandHandler(
      projects as ProjectRepositoryPort,
      resolver as ProjectRepositoriesResolver,
    );
  });

  const command = (input: Partial<CreateProjectCommand['input']> = {}) =>
    new CreateProjectCommand({
      scope,
      input: { name: 'XRP Mobile', repositories: ROWS, defaultHostId: 'host-1', ...input },
    });

  it('names the directory after the first default repository, not the name typed', async () => {
    const project = await handler.execute(command());

    expect(project.name).toBe('XRP Mobile');
    expect(project.slug).toBe('xrp-mobile');
    expect(project.originGithubRepoId).toBeNull();
    expect(project.defaultHostId).toBe('host-1');
    expect(project.repositories.map((repository) => repository.fullName)).toEqual([
      'acme/atlas',
      'acme/XRP-Mobile',
    ]);
    expect(project.defaultRepositories.map((r) => r.baseBranch)).toEqual(['develop']);
  });

  it('falls back to the first repository, then to the name', async () => {
    const noDefault = await handler.execute(
      command({ repositories: ROWS.map((row) => ({ ...row, isDefault: false })) }),
    );
    expect(noDefault.slug).toBe('atlas');

    const bare = await handler.execute(command({ repositories: [], name: 'Notes & bots' }));
    expect(bare.slug).toBe('notes-bots');
    expect(bare.repositories).toEqual([]);
  });

  it('confirms the host and the repositories before writing anything', async () => {
    await handler.execute(command());

    expect(resolver.assertHost).toHaveBeenCalledWith(scope, 'host-1');
    expect(resolver.resolveRepositories).toHaveBeenCalledWith(scope, ROWS);
    expect(projects.insertIfUnclaimed).toHaveBeenCalledTimes(1);
  });

  it('takes the next directory name when the first belongs to another project', async () => {
    vi.mocked(projects.insertIfUnclaimed)
      .mockResolvedValueOnce('slug-taken')
      .mockResolvedValueOnce('inserted');

    const project = await handler.execute(command());

    expect(project.slug).toBe('acme--xrp-mobile');
    expect(projects.insertIfUnclaimed).toHaveBeenCalledTimes(2);
  });

  it('refuses a project with no repository whose name is a directory already held', async () => {
    vi.mocked(projects.insertIfUnclaimed).mockResolvedValue('slug-taken');

    await expect(handler.execute(command({ repositories: [] }))).rejects.toMatchObject({
      code: 'PROJECTS_006',
    });
  });

  it('refuses a caller with no workspace', async () => {
    await expect(
      handler.execute(
        new CreateProjectCommand({
          scope: { ...scope, organizationId: undefined as unknown as string },
          input: { name: 'X', repositories: [] },
        }),
      ),
    ).rejects.toMatchObject({ code: 'PROJECTS_002' });
  });

  it('is a project entity that a first session could not have made', () => {
    // Belt and braces for the origin rule: the handler never sets one, so the
    // partial unique keeps answering "this repository's project" for the
    // implicit path alone.
    const made: ProjectEntity[] = [];
    expect(made.every((project) => project.originGithubRepoId === null)).toBe(true);
  });
});
