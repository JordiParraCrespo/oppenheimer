import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectInsertOutcome,
  ProjectRepositoryPort,
} from '../../database/project.repository.port';
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
 * A stand-in for the table, with the two behaviours that matter: the unique
 * **origin**, which decides who creates a repository's project, and the unique
 * **slug**, which decides who gets a directory name. Doubling the constraints
 * rather than the repository is what makes both races testable without a
 * database — and the integration suite then proves Postgres behaves the way this
 * double claims.
 */
function fakeProjects() {
  const rows: ProjectEntity[] = [];
  const port: Pick<ProjectRepositoryPort, 'insertIfUnclaimed' | 'findOneByOrigin'> = {
    insertIfUnclaimed: vi.fn(async (entity: ProjectEntity): Promise<ProjectInsertOutcome> => {
      if (rows.some((row) => row.originGithubRepoId === entity.originGithubRepoId)) {
        return 'origin-taken';
      }
      if (rows.some((row) => row.slug === entity.slug)) return 'slug-taken';
      rows.push(entity);
      return 'inserted';
    }),
    findOneByOrigin: vi.fn(
      async (_scope: AccessScope, githubRepoId: string): Promise<Option<ProjectEntity>> => {
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

  const ensure = (owner: string, name: string, githubRepoId: string) =>
    resolver.ensureForRepository(scope(), { githubRepoId, owner, name });

  it('creates the project on a repository’s first session, named after it', async () => {
    const project = await ensure('acme', 'xrp-mobile', '42');

    expect(projects.rows).toHaveLength(1);
    expect(project.slug).toBe('xrp-mobile');
    // The display name is GitHub's, not the sanitised directory name.
    expect(project.name).toBe('xrp-mobile');
    expect(project.originGithubRepoId).toBe('42');
  });

  it('keeps GitHub’s spelling as the display name', async () => {
    const project = await ensure('acme', 'XRP_Mobile', '42');

    expect(project.name).toBe('XRP_Mobile');
    expect(project.slug).toBe('xrp-mobile');
  });

  it('finds the project by GitHub’s id on every session after the first', async () => {
    const first = await ensure('acme', 'xrp-mobile', '42');
    // A repository renamed on GitHub is the same project: the id is what is
    // looked up, not the name.
    const second = await ensure('acme', 'xrp-wallet', '42');

    expect(second.id).toBe(first.id);
    expect(projects.rows).toHaveLength(1);
    expect(projects.port.insertIfUnclaimed).toHaveBeenCalledTimes(1);
  });

  it('resolves two concurrent first sessions to one project', async () => {
    const [left, right] = await Promise.all([
      ensure('acme', 'xrp-mobile', '42'),
      ensure('acme', 'xrp-mobile', '42'),
    ]);

    expect(left.id).toBe(right.id);
    expect(projects.rows).toHaveLength(1);
  });

  it('resolves two concurrent first sessions to one project even when the plain slug is taken', async () => {
    // The hole a slug-keyed conflict target leaves: both racers lose the plain
    // name to a different repository, both derive `<owner>--<repo>`, and only a
    // unique origin stops them both landing.
    await ensure('acme', 'xrp-mobile', '1');

    const [left, right] = await Promise.all([
      ensure('other', 'xrp-mobile', '2'),
      ensure('other', 'xrp-mobile', '2'),
    ]);

    expect(left.id).toBe(right.id);
    expect(projects.rows).toHaveLength(2);
    expect(left.slug).toBe('other--xrp-mobile');
  });

  it('qualifies the directory when another repository holds the plain name', async () => {
    await ensure('acme', 'xrp-mobile', '1');
    const other = await ensure('other', 'xrp-mobile', '2');

    expect(other.slug).toBe('other--xrp-mobile');
    expect(other.name).toBe('xrp-mobile');
  });

  it('falls back to GitHub’s id when owner--repo is taken as well', async () => {
    await ensure('acme', 'xrp-mobile', '1');
    await ensure('other', 'xrp-mobile', '2');
    // A third repository deriving both taken candidates — the same owner and
    // name under a different GitHub id, as a transfer or a re-create leaves
    // behind. The id is the one segment nothing else can hold.
    const third = await ensure('other', 'xrp-mobile', '3');

    expect(third.slug).toBe('other--xrp-mobile-3');
  });

  it('reads the winner back rather than assuming it won', async () => {
    await ensure('acme', 'xrp-mobile', '42');
    vi.mocked(projects.port.findOneByOrigin).mockClear();

    await ensure('acme', 'xrp-mobile', '42');

    // One read, no insert: the project exists, so nothing is attempted.
    expect(projects.port.findOneByOrigin).toHaveBeenCalledTimes(1);
    expect(projects.port.insertIfUnclaimed).toHaveBeenCalledTimes(1);
  });

  it('refuses when the caller has no active workspace', async () => {
    await expect(
      resolver.ensureForRepository(scope({ organizationId: null }), {
        githubRepoId: '42',
        owner: 'acme',
        name: 'xrp-mobile',
      }),
    ).rejects.toMatchObject({ code: 'PROJECTS_002' });
  });

  it('findForRepository creates nothing', async () => {
    expect((await resolver.findForRepository(scope(), '42')).isNone()).toBe(true);
    expect(projects.port.insertIfUnclaimed).not.toHaveBeenCalled();
  });
});
