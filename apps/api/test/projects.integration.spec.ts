import { randomUUID } from 'node:crypto';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { AddProjectRolePermissions1789000100000 } from '../src/migrations/1789000100000-AddProjectRolePermissions';
import { ProjectLookupResolver } from '../src/projects/application/project-lookup.resolver';
import { ProjectOrmEntity } from '../src/projects/database/project.orm-entity';
import { ProjectRepository } from '../src/projects/database/project.repository';
import { ProjectRepositoryOrmEntity } from '../src/projects/database/project-repository.orm-entity';
import { ProjectEntity } from '../src/projects/domain/project.entity';
import { ProjectMapper } from '../src/projects/project.mapper';
import { runAllMigrations } from './run-migrations';

/**
 * The auto-creation races, against a real Postgres.
 *
 * The unit tests double the two unique constraints; this is the layer that
 * proves Postgres behaves the way the double claims — and that the migration
 * actually created the constraints the statements name. Get either wrong and two
 * concurrent first sessions on one repository quietly produce two projects, two
 * directories and two branches, which is a bug no unit test could catch.
 *
 * The schema is built by running the **whole migration chain**, so a mistake in a
 * migration fails here rather than in production.
 */
describe('projects: race-safe auto-creation (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let resolver: ProjectLookupResolver;
  let repository: ProjectRepository;
  let organizationId: string;

  const scope = () => ({
    userId: randomUUID(),
    organizationId,
    teamIds: [] as string[],
    grants: new Map<string, Set<string>>(),
    bypass: false,
  });

  const projectRows = (): Promise<{ id: string; slug: string; name: string }[]> =>
    dataSource.query(
      `SELECT "id", "slug", "name", "originGithubRepoId" FROM "project"
        WHERE "organizationId" = $1 ORDER BY "createdAt"`,
      [organizationId],
    );

  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = pgContainer.getHost();
    process.env.DB_PORT = pgContainer.getMappedPort(5432).toString();
    process.env.DB_USERNAME = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_DATABASE = 'test';

    await runAllMigrations();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      // No Nest container here on purpose: the races live in the repository and
      // the resolver, and booting the application would only add Redis and
      // Better Auth to the set of things that can make this suite red.
      entities: [ProjectOrmEntity, ProjectRepositoryOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();

    repository = new ProjectRepository(
      dataSource.getRepository(ProjectOrmEntity),
      new ProjectMapper(),
    );
    resolver = new ProjectLookupResolver(repository);
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    // A workspace per test: `project.organizationId` has a foreign key, and both
    // uniqueness rules are per workspace.
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, $2, $3)`,
      [organizationId, 'Acme', `acme-${organizationId.slice(0, 8)}`],
    );
  });

  it('resolves two concurrent first sessions on one repository to a single project', async () => {
    const origin = { githubRepoId: '4242', owner: 'acme', name: 'xrp-mobile' };
    const caller = scope();

    const [left, right] = await Promise.all([
      resolver.ensureForRepository(caller, origin),
      resolver.ensureForRepository(caller, origin),
    ]);

    expect(left.id).toBe(right.id);
    const rows = await projectRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: left.id, slug: 'xrp-mobile', name: 'xrp-mobile' });
    // A bigint comes back as a string, and stays one.
    expect(rows[0].originGithubRepoId).toBe('4242');
  });

  it('holds the origin unique even when the plain directory name is already taken', async () => {
    // The race a slug-keyed conflict target cannot win: both callers lose the
    // plain name to a different repository, both derive `<owner>--<repo>`, and
    // only the unique origin stops both of them landing.
    await resolver.ensureForRepository(scope(), {
      githubRepoId: '1',
      owner: 'acme',
      name: 'xrp-mobile',
    });

    const origin = { githubRepoId: '2', owner: 'other', name: 'xrp-mobile' };
    const [left, right] = await Promise.all([
      resolver.ensureForRepository(scope(), origin),
      resolver.ensureForRepository(scope(), origin),
    ]);

    expect(left.id).toBe(right.id);
    expect(left.slug).toBe('other--xrp-mobile');
    const rows = await projectRows();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.slug)).toEqual(['xrp-mobile', 'other--xrp-mobile']);
  });

  it('reports each conflict as what it is, from the statement itself', async () => {
    // The two outcomes on their own: a second repository wanting a taken
    // directory name, and a second create for a repository that already has a
    // project. Both come back from the write rather than as a thrown violation.
    const first = ProjectEntity.createNew({
      organizationId,
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
      originGithubRepoId: '1',
    });
    const sameSlug = ProjectEntity.createNew({
      organizationId,
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
      originGithubRepoId: '2',
    });
    const sameOrigin = ProjectEntity.createNew({
      organizationId,
      name: 'xrp-mobile',
      slug: 'acme--xrp-mobile',
      originGithubRepoId: '1',
    });

    expect(await repository.insertIfUnclaimed(first)).toBe('inserted');
    expect(await repository.insertIfUnclaimed(sameSlug)).toBe('slug-taken');
    expect(await repository.insertIfUnclaimed(sameOrigin)).toBe('origin-taken');
    expect(await projectRows()).toHaveLength(1);
  });

  it('keeps the same repository’s project across a GitHub rename', async () => {
    const caller = scope();

    const first = await resolver.ensureForRepository(caller, {
      githubRepoId: '7',
      owner: 'acme',
      name: 'xrp-mobile',
    });
    const again = await resolver.ensureForRepository(caller, {
      githubRepoId: '7',
      owner: 'acme',
      name: 'xrp-wallet',
    });

    expect(again.id).toBe(first.id);
  });

  it('scopes every read and every rename to the workspace', async () => {
    const caller = scope();
    const project = await resolver.ensureForRepository(caller, {
      githubRepoId: '11',
      owner: 'acme',
      name: 'xrp-mobile',
    });

    const other = { ...caller, organizationId: randomUUID() };
    expect(await repository.findAll(other)).toEqual([]);
    expect((await repository.findOneById(other, project.id)).isNone()).toBe(true);

    project.rename('XRP Mobile');
    expect((await repository.saveIfActive(other, project)).isNone()).toBe(true);
    expect((await repository.saveIfActive(caller, project)).unwrap().name).toBe('XRP Mobile');
  });

  it('never lets a rename revive a project that was retired meanwhile', async () => {
    const caller = scope();
    const project = await resolver.ensureForRepository(caller, {
      githubRepoId: '12',
      owner: 'acme',
      name: 'xrp-mobile',
    });

    // The column the slice that owns sessions will write. The rename below loaded
    // before it was set, which is exactly the stale snapshot a whole-aggregate
    // save would write back over the archive.
    await dataSource.query(`UPDATE "project" SET "archivedAt" = now() WHERE "id" = $1`, [
      project.id,
    ]);
    project.rename('XRP Mobile');

    expect((await repository.saveIfActive(caller, project)).isNone()).toBe(true);
    const [row] = await dataSource.query(
      `SELECT "name", "archivedAt" FROM "project" WHERE "id" = $1`,
      [project.id],
    );
    expect(row.archivedAt).not.toBeNull();
    expect(row.name).toBe('xrp-mobile');
    // And the listing leaves a retired project out.
    expect(await repository.findAll(caller)).toEqual([]);
  });

  it('grants a workspace owner its projects, and bumps the cached role version', async () => {
    // Without this migration every project route answers 403 for the person who
    // owns the workspace: the ability comes from the database role, and `owner`
    // was seeded before `Project` existed.
    const rule = {
      action: 'manage',
      subject: 'Project',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder the ability builder interpolates
      conditions: { organizationId: '${activeOrganizationId}' },
    };
    const ownerRules = async () => {
      const [role] = await dataSource.query(
        `SELECT "permissions" FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL`,
      );
      return role.permissions as Record<string, unknown>[];
    };
    const roleVersion = async () => {
      const [row] = await dataSource.query(
        `SELECT "roleVersion" FROM "organization" WHERE "id" = $1`,
        [organizationId],
      );
      return row.roleVersion as number;
    };

    expect(await ownerRules()).toContainEqual(rule);

    // Reverting and re-running is what proves `down()` removes exactly this rule
    // and that the version bump reaches workspaces that already exist. The
    // migration is driven directly rather than through `undoLastMigration`, which
    // would revert whatever migration happens to be last in the chain — and that is
    // a different one every time a slice lands.
    const migration = new AddProjectRolePermissions1789000100000();
    const runner = dataSource.createQueryRunner();
    await migration.down(runner);
    expect(await ownerRules()).not.toContainEqual(rule);
    const before = await roleVersion();

    await migration.up(runner);
    await runner.release();
    expect(await ownerRules()).toContainEqual(rule);
    expect(await roleVersion()).toBe(before + 1);
  });
});
