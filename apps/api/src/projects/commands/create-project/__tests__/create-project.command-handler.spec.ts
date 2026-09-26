import type { AccessScope } from '@oppenheimer/backend-authz';
import type { ProjectRepositoryInputDto } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSettingsResolver } from '../../../application/project-settings.resolver';
import type {
  NamedProjectInsertOutcome,
  ProjectRepositoryPort,
} from '../../../database/project.repository.port';
import type { ProjectEntity } from '../../../domain/project.entity';
import { CreateProjectCommand } from '../create-project.command';
import { CreateProjectCommandHandler } from '../create-project.command-handler';

const scope = (overrides: Partial<AccessScope> = {}): AccessScope => ({
  userId: 'member-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
  ...overrides,
});

const INPUT = {
  name: 'Client sites',
  repositories: [
    { installationId: 'installation-1', githubRepoId: 7, baseBranch: 'main', isDefault: true },
    { installationId: 'installation-1', githubRepoId: 42, baseBranch: 'dev', isDefault: false },
  ],
  defaultHostId: 'host-1',
  defaultAgent: 'claude-code' as const,
  instructions: 'Run pnpm test before every commit.',
};

describe('CreateProjectCommandHandler', () => {
  let taken: Set<string>;
  let projects: Pick<ProjectRepositoryPort, 'insertNamed'>;
  let settings: Pick<ProjectSettingsResolver, 'repositories' | 'assertUsableHost'>;
  let handler: CreateProjectCommandHandler;

  beforeEach(() => {
    taken = new Set();
    projects = {
      insertNamed: vi.fn(async (entity: ProjectEntity): Promise<NamedProjectInsertOutcome> => {
        if (taken.has(entity.slug)) return 'slug-taken';
        taken.add(entity.slug);
        return 'inserted';
      }),
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
    handler = new CreateProjectCommandHandler(
      projects as ProjectRepositoryPort,
      settings as ProjectSettingsResolver,
    );
  });

  it('creates the project with its repositories, defaults and instructions', async () => {
    const project = await handler.execute(
      new CreateProjectCommand({ scope: scope(), input: INPUT }),
    );

    expect(project.name).toBe('Client sites');
    expect(project.slug).toBe('client-sites');
    expect(project.organizationId).toBe('org-acme');
    expect(project.createdByUserId).toBe('member-1');
    expect(project.originGithubRepoId).toBeNull();
    expect(project.defaultHostId).toBe('host-1');
    expect(project.defaultAgent).toBe('claude-code');
    expect(project.instructions).toBe('Run pnpm test before every commit.');
    expect(project.repositories.map((repository) => repository.githubRepoId)).toEqual(['7', '42']);
    expect(settings.assertUsableHost).toHaveBeenCalledWith(scope(), 'host-1');
  });

  it('takes the id-suffixed directory name when the plain one is held', async () => {
    taken.add('client-sites');

    const project = await handler.execute(
      new CreateProjectCommand({ scope: scope(), input: INPUT }),
    );

    // Derived from the row itself, so it can be read back to the project.
    expect(project.slug).toBe(`client-sites-${project.id.replace(/-/g, '').slice(0, 8)}`);
  });

  it('refuses when the caller has no active workspace', async () => {
    await expect(
      handler.execute(
        new CreateProjectCommand({ scope: scope({ organizationId: null }), input: INPUT }),
      ),
    ).rejects.toMatchObject({ code: 'PROJECTS_002' });
    expect(projects.insertNamed).not.toHaveBeenCalled();
  });

  it('writes nothing when a repository cannot be resolved', async () => {
    vi.mocked(settings.repositories).mockRejectedValue(new Error('GITHUB_010'));

    await expect(
      handler.execute(new CreateProjectCommand({ scope: scope(), input: INPUT })),
    ).rejects.toThrow('GITHUB_010');
    expect(projects.insertNamed).not.toHaveBeenCalled();
  });
});
