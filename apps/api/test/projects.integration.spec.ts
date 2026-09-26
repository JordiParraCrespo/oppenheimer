import { randomUUID } from 'node:crypto';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { AddProjectRolePermissions1789000100000 } from '../src/migrations/1789000100000-AddProjectRolePermissions';
import { ProjectOrmEntity } from '../src/projects/database/project.orm-entity';
import { ProjectRepository } from '../src/projects/database/project.repository';
import { ProjectRepositoryOrmEntity } from '../src/projects/database/project-repository.orm-entity';
import { ProjectEntity } from '../src/projects/domain/project.entity';
import { ProjectMapper } from '../src/projects/project.mapper';
import { runAllMigrations } from './run-migrations';

/**
 * Projects against a real Postgres: the slug constraint, the repository set and
 * its composite keys, the scoped writes and the archive.
 *
 * The unit tests double the constraints; this is the layer that proves Postgres
 * behaves the way the doubles claim, and that the migration created what the
 * statements name.
 *
 * The schema is built by running the **whole migration chain**, so a mistake in a
 * migration fails here rather than in production.
 */
describe('projects: the saved scope (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let repository: ProjectRepository;
  let organizationId: string;
  let installationId: string;

  const held = (githubRepoId: string, isDefault = true) => ({
    installationId,
    githubRepoId,
    repositoryFullName: `acme/repo-${githubRepoId}`,
    baseBranch: 'main',
    isDefault,
  });

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
      // No Nest container here on purpose: what is proved lives in the repository,
      // and booting the application would only add Redis and Better Auth to the
      // set of things that can make this suite red.
      entities: [ProjectOrmEntity, ProjectRepositoryOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();

    repository = new ProjectRepository(
      dataSource.getRepository(ProjectOrmEntity),
      new ProjectMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    // A workspace per test: `project.organizationId` has a foreign key, and the
    // slug is unique per workspace.
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, $2, $3)`,
      [organizationId, 'Acme', `acme-${organizationId.slice(0, 8)}`],
    );
    installationId = await insertInstallation(organizationId);
  });

  async function insertInstallation(org: string): Promise<string> {
    const id = randomUUID();
    const [user] = await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz') RETURNING "id"`,
      [randomUUID(), `${randomUUID()}@example.com`],
    );
    await dataSource.query(
      `INSERT INTO "github_installation"
         ("id", "organizationId", "githubInstallationId", "accountLogin", "accountType",
          "repositorySelection", "installedByUserId")
       VALUES ($1, $2, $3, 'acme', 'Organization', 'all', $4)`,
      [id, org, Math.floor(Math.random() * 1_000_000_000), user.id],
    );
    return id;
  }

  const newProject = (slug: string, repositories = [held('11')]) =>
    ProjectEntity.createNew({ organizationId, name: slug, slug, repositories });

  it('scopes every read and every save to the workspace', async () => {
    const caller = scope();
    const project = newProject('xrp-mobile');
    await repository.insert(project);

    const other = { ...caller, organizationId: randomUUID() };
    expect(await repository.findAll(other)).toEqual([]);
    expect((await repository.findOneById(other, project.id)).isNone()).toBe(true);

    project.rename('XRP Mobile');
    expect((await repository.saveSettingsIfActive(other, project)).isNone()).toBe(true);
    expect((await repository.saveSettingsIfActive(caller, project)).unwrap().name).toBe(
      'XRP Mobile',
    );
  });

  it('never lets a save revive a project that was retired meanwhile', async () => {
    const caller = scope();
    const project = newProject('xrp-mobile');
    await repository.insert(project);

    // The save below loaded before the archive landed, which is exactly the stale
    // snapshot a whole-aggregate write would put back over it.
    await dataSource.query(`UPDATE "project" SET "archivedAt" = now() WHERE "id" = $1`, [
      project.id,
    ]);
    project.rename('XRP Mobile');

    expect((await repository.saveSettingsIfActive(caller, project)).isNone()).toBe(true);
    const [row] = await dataSource.query(
      `SELECT "name", "archivedAt" FROM "project" WHERE "id" = $1`,
      [project.id],
    );
    expect(row.archivedAt).not.toBeNull();
    expect(row.name).toBe('xrp-mobile');
    // And the listing leaves a retired project out.
    expect(await repository.findAll(caller)).toEqual([]);
  });

  it('creates a named project with its repositories, in order, and its defaults', async () => {
    const project = ProjectEntity.createNew({
      organizationId,
      name: 'Client sites',
      slug: 'client-sites',
      repositories: [held('31'), held('32', false)],
      defaultAgent: 'codex',
      instructions: 'Run the tests.',
    });

    expect(await repository.insert(project)).toBe('inserted');

    const stored = (await repository.findOneById(scope(), project.id)).unwrap();
    expect(stored.repositories.map((held) => held.githubRepoId)).toEqual(['31', '32']);
    expect(stored.repositories.map((held) => held.isDefault)).toEqual([true, false]);
    expect(stored.defaultAgent).toBe('codex');
    expect(stored.instructions).toBe('Run the tests.');
  });

  it('reports a taken directory name, and leaves no repository rows behind', async () => {
    const first = ProjectEntity.createNew({
      organizationId,
      name: 'Client sites',
      slug: 'client-sites',
      repositories: [held('41')],
    });
    const second = ProjectEntity.createNew({
      organizationId,
      name: 'Client Sites',
      slug: 'client-sites',
      repositories: [held('42')],
    });

    expect(await repository.insert(first)).toBe('inserted');
    expect(await repository.insert(second)).toBe('slug-taken');
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int FROM "project_repository" WHERE "projectId" = $1`,
      [second.id],
    );
    expect(count).toBe(0);
  });

  it('lets two projects hold the same repository', async () => {
    for (const slug of ['one', 'two']) {
      const project = ProjectEntity.createNew({
        organizationId,
        name: slug,
        slug,
        repositories: [held('51')],
      });
      expect(await repository.insert(project)).toBe('inserted');
    }

    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int FROM "project_repository"
        WHERE "organizationId" = $1 AND "githubRepoId" = '51'`,
      [organizationId],
    );
    expect(count).toBe(2);
  });

  it('replaces the repository set on save, and keeps it on an archived project', async () => {
    const caller = scope();
    const project = ProjectEntity.createNew({
      organizationId,
      name: 'Atlas',
      slug: 'atlas',
      repositories: [held('61'), held('62', false)],
    });
    await repository.insert(project);

    project.configure({ repositories: [held('63')], defaultHostId: null, instructions: 'x' });
    const saved = (await repository.saveSettingsIfActive(caller, project)).unwrap();

    expect(saved.repositories.map((held) => held.githubRepoId)).toEqual(['63']);
    expect(saved.instructions).toBe('x');

    const archived = await repository.archiveIfUnused(caller, project.id, async () => false);
    expect(archived.result).toBe('archived');
    if (archived.result !== 'not-found') {
      expect(archived.project.repositories.map((held) => held.githubRepoId)).toEqual(['63']);
    }
  });

  it('refuses a project holding another workspace’s installation, by constraint', async () => {
    const otherOrganization = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, $2, $3)`,
      [otherOrganization, 'Other', `other-${otherOrganization.slice(0, 8)}`],
    );
    const foreign = await insertInstallation(otherOrganization);
    const project = ProjectEntity.createNew({
      organizationId,
      name: 'Stolen',
      slug: 'stolen',
      repositories: [{ ...held('71'), installationId: foreign }],
    });

    await expect(repository.insert(project)).rejects.toThrow(
      /FK_project_repository_installation|foreign key/i,
    );
    // The transaction rolled the project back with its repositories.
    expect((await repository.findOneById(scope(), project.id)).isNone()).toBe(true);
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
