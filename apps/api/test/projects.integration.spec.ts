import { randomUUID } from 'node:crypto';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { ProjectLookupResolver } from '../src/projects/application/project-lookup.resolver';
import { ProjectOrmEntity } from '../src/projects/database/project.orm-entity';
import { ProjectRepository } from '../src/projects/database/project.repository';
import { ProjectEntity } from '../src/projects/domain/project.entity';
import { ProjectMapper } from '../src/projects/project.mapper';
import { runAllMigrations } from './run-migrations';

/**
 * The auto-creation race, against a real Postgres.
 *
 * The unit tests double the unique constraint; this is the layer that proves
 * Postgres behaves the way the double claims — and that the migration actually
 * created the constraint the `ON CONFLICT` target names. Get either wrong and
 * two concurrent first sessions on one repository quietly produce two projects,
 * two directories and two branches, which is a bug no unit test could catch.
 *
 * The schema is built by running the **whole migration chain**, so a mistake in
 * the migration fails here rather than in production.
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
      // No Nest container here on purpose: the race lives in the repository and
      // the resolver, and booting the application would only add Redis and
      // Better Auth to the set of things that can make this suite red.
      entities: [ProjectOrmEntity, OutboxMessageSchema],
      synchronize: false,
    });
    await dataSource.initialize();

    repository = new ProjectRepository(
      dataSource.getRepository(ProjectOrmEntity),
      new ProjectMapper(),
      new OutboxService(dataSource),
    );
    resolver = new ProjectLookupResolver(repository);
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    // A workspace per test: `project.organizationId` has a foreign key, and the
    // unique slug is per workspace.
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, $2, $3)`,
      [organizationId, 'Acme', `acme-${organizationId.slice(0, 8)}`],
    );
  });

  it('resolves two concurrent first sessions on one repository to a single project', async () => {
    const origin = { githubRepoId: 4242, repositoryName: 'acme/xrp-mobile' };
    const caller = scope();

    const [left, right] = await Promise.all([
      resolver.ensureForRepository(caller, origin),
      resolver.ensureForRepository(caller, origin),
    ]);

    expect(left).toBe(right);
    const rows = await dataSource.query(
      `SELECT "id", "slug", "name", "originGithubRepoId" FROM "project" WHERE "organizationId" = $1`,
      [organizationId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: left, slug: 'xrp-mobile', name: 'xrp-mobile' });
    // A bigint comes back as a string; the domain holds the number.
    expect(Number(rows[0].originGithubRepoId)).toBe(4242);
  });

  it('reports a taken slug from the insert itself, never from a second query', async () => {
    // The statement under test, on its own: the migration's
    // `UQ_project_organization_slug` is the conflict target, and a losing insert
    // has to come back as `false` rather than as a thrown unique violation.
    const first = ProjectEntity.createNew({
      organizationId,
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
      originGithubRepoId: 1,
    });
    const second = ProjectEntity.createNew({
      organizationId,
      name: 'xrp-mobile',
      slug: 'xrp-mobile',
      originGithubRepoId: 2,
    });

    expect(await repository.insertIfSlugAvailable(first)).toBe(true);
    expect(await repository.insertIfSlugAvailable(second)).toBe(false);

    const rows = await dataSource.query(`SELECT "id" FROM "project" WHERE "organizationId" = $1`, [
      organizationId,
    ]);
    expect(rows).toEqual([{ id: first.id }]);
  });

  it('gives the second repository with the same name a suffixed directory', async () => {
    const caller = scope();

    const first = await resolver.ensureForRepository(caller, {
      githubRepoId: 1,
      repositoryName: 'acme/xrp-mobile',
    });
    const second = await resolver.ensureForRepository(caller, {
      githubRepoId: 2,
      repositoryName: 'other/xrp-mobile',
    });

    expect(second).not.toBe(first);
    const rows = await dataSource.query(
      `SELECT "id", "slug", "name" FROM "project" WHERE "organizationId" = $1 ORDER BY "createdAt"`,
      [organizationId],
    );
    expect(rows.map((row: { slug: string }) => row.slug)).toEqual([
      'xrp-mobile',
      expect.stringMatching(/^xrp-mobile-[0-9a-z]{4}$/),
    ]);
    // Only the directory differs: the display name is the repository's either way.
    expect(rows[1].name).toBe('xrp-mobile');
  });

  it('keeps the same repository’s project across a GitHub rename', async () => {
    const caller = scope();

    const first = await resolver.ensureForRepository(caller, {
      githubRepoId: 7,
      repositoryName: 'acme/xrp-mobile',
    });
    const again = await resolver.ensureForRepository(caller, {
      githubRepoId: 7,
      repositoryName: 'acme/xrp-wallet',
    });

    expect(again).toBe(first);
  });

  it('scopes every read to the workspace, and hides archived projects by default', async () => {
    const caller = scope();
    const projectId = await resolver.ensureForRepository(caller, {
      githubRepoId: 11,
      repositoryName: 'acme/xrp-mobile',
    });

    const other = { ...caller, organizationId: randomUUID() };
    expect(await repository.findAll(other, { includeArchived: false })).toEqual([]);
    expect((await repository.findOneById(other, projectId)).isNone()).toBe(true);

    const found = await repository.findOneById(caller, projectId);
    const project = found.unwrap();
    project.archive();
    await repository.save(project);

    expect(await repository.findAll(caller, { includeArchived: false })).toEqual([]);
    expect(await repository.findAll(caller, { includeArchived: true })).toHaveLength(1);
    // The slug survives archiving: it is a retired directory name, not a freed one.
    const [row] = await dataSource.query(
      `SELECT "slug", "archivedAt" FROM "project" WHERE "id" = $1`,
      [projectId],
    );
    expect(row.slug).toBe('xrp-mobile');
    expect(row.archivedAt).not.toBeNull();
    // Archiving raised a domain event, staged on the outbox in the same
    // transaction as the write.
    const staged = await dataSource.query(
      `SELECT "eventName" FROM "outbox_message" WHERE "aggregateId" = $1`,
      [projectId],
    );
    expect(staged).toEqual([{ eventName: 'ProjectArchivedDomainEvent' }]);
  });
});
