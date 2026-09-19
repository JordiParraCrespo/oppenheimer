import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectLookupResolver } from '../project-lookup.resolver';

const scope = (overrides: Partial<AccessScope> = {}): AccessScope => ({
  userId: 'member-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
  ...overrides,
});

/**
 * A stand-in for the table, with the one behaviour that matters: the unique
 * `(organizationId, slug)` constraint, and an insert that loses quietly.
 *
 * Doubling the constraint rather than the repository is what makes the race
 * testable without a database — the integration suite then proves Postgres
 * behaves the way this double claims.
 */
function fakeProjects() {
  const rows: ProjectEntity[] = [];
  const port: Pick<ProjectRepositoryPort, 'insertIfSlugAvailable' | 'findOneByOrigin'> = {
    insertIfSlugAvailable: vi.fn(async (entity: ProjectEntity) => {
      if (rows.some((row) => row.slug === entity.slug)) return false;
      rows.push(entity);
      return true;
    }),
    findOneByOrigin: vi.fn(
      async (_scope: AccessScope, githubRepoId: number): Promise<Option<ProjectEntity>> => {
        const found = rows.find((row) => row.originGithubRepoId === githubRepoId);
        return found ? Some(found) : None;
      },
    ),
  };
  return { rows, port };
}

describe('ProjectLookupResolver', () => {
  let projects: ReturnType<typeof fakeProjects>;
  let resolver: ProjectLookupResolver;

  beforeEach(() => {
    projects = fakeProjects();
    resolver = new ProjectLookupResolver(projects.port as ProjectRepositoryPort);
  });

  const ensure = (repositoryName: string, githubRepoId: number) =>
    resolver.ensureForRepository(scope(), { githubRepoId, repositoryName });

  it('creates the project on a repository’s first session, named after it', async () => {
    const projectId = await ensure('acme/xrp-mobile', 42);

    expect(projects.rows).toHaveLength(1);
    expect(projects.rows[0]).toMatchObject({ id: projectId });
    expect(projects.rows[0].slug).toBe('xrp-mobile');
    expect(projects.rows[0].name).toBe('xrp-mobile');
    expect(projects.rows[0].originGithubRepoId).toBe(42);
  });

  it('finds the project by GitHub’s id on every session after the first', async () => {
    const first = await ensure('acme/xrp-mobile', 42);
    // A repository renamed on GitHub is the same project: the id is what is
    // looked up, not the name.
    const second = await ensure('acme/xrp-wallet', 42);

    expect(second).toBe(first);
    expect(projects.rows).toHaveLength(1);
    expect(projects.port.insertIfSlugAvailable).toHaveBeenCalledTimes(1);
  });

  it('resolves two concurrent first sessions to one project', async () => {
    const [left, right] = await Promise.all([
      ensure('acme/xrp-mobile', 42),
      ensure('acme/xrp-mobile', 42),
    ]);

    expect(left).toBe(right);
    expect(projects.rows).toHaveLength(1);
  });

  it('suffixes the slug when another repository already holds it', async () => {
    await ensure('acme/xrp-mobile', 42);
    const otherId = await ensure('other/xrp-mobile', 99);

    expect(otherId).not.toBe(projects.rows[0].id);
    expect(projects.rows).toHaveLength(2);
    expect(projects.rows[1].slug).toMatch(/^xrp-mobile-[0-9a-z]{4}$/);
    // The display name is still the repository's, only the directory differs.
    expect(projects.rows[1].name).toBe('xrp-mobile');
  });

  it('never re-reads instead of inserting: the loser of a race re-reads by origin', async () => {
    await ensure('acme/xrp-mobile', 42);
    vi.mocked(projects.port.findOneByOrigin).mockClear();

    await ensure('acme/xrp-mobile', 42);

    // One read, no insert: the project exists, so nothing is attempted.
    expect(projects.port.findOneByOrigin).toHaveBeenCalledTimes(1);
  });

  it('refuses when the caller has no active workspace', async () => {
    await expect(
      resolver.ensureForRepository(scope({ organizationId: null }), {
        githubRepoId: 42,
        repositoryName: 'acme/xrp-mobile',
      }),
    ).rejects.toMatchObject({ code: 'PROJECTS_003' });
  });

  it('gives up after a bounded number of collisions rather than spinning', async () => {
    // Every slug taken by a project with a different origin — the state the
    // random suffix makes improbable, and which must still terminate.
    vi.mocked(projects.port.insertIfSlugAvailable).mockResolvedValue(false);

    await expect(ensure('acme/xrp-mobile', 42)).rejects.toMatchObject({ code: 'PROJECTS_004' });
    expect(projects.port.insertIfSlugAvailable).toHaveBeenCalledTimes(5);
  });

  it('findForRepository creates nothing', async () => {
    expect((await resolver.findForRepository(scope(), 42)).isNone()).toBe(true);
    expect(projects.port.insertIfSlugAvailable).not.toHaveBeenCalled();
  });
});
