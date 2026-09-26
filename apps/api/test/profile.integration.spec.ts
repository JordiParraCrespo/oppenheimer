import { randomUUID } from 'node:crypto';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { AccountErasureRepository } from '../src/profile/database/account-erasure.repository';
import { ProjectOrmEntity } from '../src/projects/database/project.orm-entity';
import { ProjectRepositoryOrmEntity } from '../src/projects/database/project-repository.orm-entity';
import { SessionCheckoutOrmEntity } from '../src/sessions/database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from '../src/sessions/database/work-session.orm-entity';
import { WorkSessionRepository } from '../src/sessions/database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../src/sessions/database/work-session-event.orm-entity';
import { SessionCheckoutEntity } from '../src/sessions/domain/session-checkout.entity';
import { SESSION_EVENT_KINDS } from '../src/sessions/domain/session-state.policy';
import { WorkSessionEntity } from '../src/sessions/domain/work-session.entity';
import { WorkSessionMapper } from '../src/sessions/work-session.mapper';
import { runAllMigrations } from './run-migrations';

/**
 * Deleting an account and the username column, against a real Postgres.
 *
 * Erasure is raw SQL across tables four modules own, every edge between them
 * `RESTRICT`, so the only proof that the statements run in an order the
 * schema accepts — and that they reach nothing a second person holds — is
 * running them against the whole migration chain.
 */
describe('profile: account erasure and usernames (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let erasure: AccountErasureRepository;
  let sessions: WorkSessionRepository;

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
      entities: [
        WorkSessionOrmEntity,
        SessionCheckoutOrmEntity,
        WorkSessionEventOrmEntity,
        ProjectOrmEntity,
        ProjectRepositoryOrmEntity,
      ],
      synchronize: false,
    });
    await dataSource.initialize();

    erasure = new AccountErasureRepository(dataSource);
    sessions = new WorkSessionRepository(
      dataSource.getRepository(WorkSessionOrmEntity),
      dataSource,
      new WorkSessionMapper(),
      {
        stageEvents: async () => undefined,
        wake: async () => undefined,
      } as unknown as OutboxService,
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  async function insertUser(username: string | null = null): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "email", "name", "firstName", "lastName", "emailVerified", "username")
       VALUES ($1, $2, 'Jordi Parra', 'Jordi', 'Parra', true, $3)`,
      [id, `${id}@example.com`, username],
    );
    return id;
  }

  async function insertWorkspace(...memberIds: string[]): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, $2, $3)`,
      [id, 'Personal', `personal-${id.slice(0, 8)}`],
    );
    for (const userId of memberIds) {
      await dataSource.query(
        `INSERT INTO "member" ("id", "organizationId", "userId", "role") VALUES ($1, $2, $3, 'owner')`,
        [randomUUID(), id, userId],
      );
    }
    return id;
  }

  /** A session with a checkout, its log, its project, host and installation. */
  async function insertWork(organizationId: string, userId: string): Promise<string> {
    const hostId = randomUUID();
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, 'devbox', 'key', $3)`,
      [hostId, userId, randomUUID()],
    );
    const projectId = randomUUID();
    await dataSource.query(
      `INSERT INTO "project" ("id", "organizationId", "name", "slug", "defaultHostId")
       VALUES ($1, $2, 'xrp', 'xrp', $3)`,
      [projectId, organizationId, hostId],
    );
    const installationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "github_installation"
         ("id", "organizationId", "githubInstallationId", "accountLogin", "accountType",
          "repositorySelection", "installedByUserId")
       VALUES ($1, $2, $3, 'acme', 'Organization', 'all', $4)`,
      [installationId, organizationId, Math.floor(Math.random() * 1_000_000_000), userId],
    );
    await dataSource.query(
      `INSERT INTO "project_repository" ("id", "projectId", "installationId", "githubRepoId", "fullName")
       VALUES ($1, $2, $3, 4242, 'acme/xrp')`,
      [randomUUID(), projectId, installationId],
    );

    const work = WorkSessionEntity.request({
      organizationId,
      projectId,
      projectSlug: 'xrp',
      createdByUserId: userId,
      hostId,
      slug: `bold-otter-${randomUUID().slice(0, 6)}`,
      agent: 'claude-code',
      idempotencyKey: null,
    });
    const checkout = SessionCheckoutEntity.createNew({
      organizationId,
      sessionId: work.id,
      installationId,
      githubRepoId: '4242',
      repositoryFullName: 'acme/xrp',
      directoryName: 'xrp',
      baseBranch: 'main',
      branch: `oppenheimer/xrp/${work.slug}`,
    });
    work.attachCheckout(checkout);
    await sessions.createIfUnclaimed(work, [
      {
        idempotencyKey: `session.requested:${randomUUID()}`,
        source: 'api',
        kind: SESSION_EVENT_KINDS.REQUESTED,
        payload: { agent: 'claude-code' },
      },
      {
        idempotencyKey: `cwd:${randomUUID()}`,
        source: 'api',
        kind: SESSION_EVENT_KINDS.CWD_SET,
        payload: { checkoutId: checkout.id },
      },
    ]);
    return work.id;
  }

  const count = async (table: string, where: string, params: unknown[]) => {
    const [row] = await dataSource.query(
      `SELECT count(*)::int AS "n" FROM "${table}" WHERE ${where}`,
      params,
    );
    return row.n as number;
  };

  describe('account erasure', () => {
    it('removes the personal workspace and everything in it, and every sign-in', async () => {
      const userId = await insertUser();
      const workspaceId = await insertWorkspace(userId);
      const sessionId = await insertWork(workspaceId, userId);
      await dataSource.query(
        `INSERT INTO "session" ("id", "userId", "token", "expiresAt")
         VALUES ($1, $2, $3, now() + interval '1 day')`,
        [randomUUID(), userId, randomUUID()],
      );
      await dataSource.query(
        `INSERT INTO "account" ("id", "userId", "accountId", "providerId") VALUES ($1, $2, $3, 'credential')`,
        [randomUUID(), userId, userId],
      );

      const workspaces = await erasure.findSoleWorkspaces(userId);
      expect(workspaces).toEqual([workspaceId]);
      expect(await erasure.hasSharedWork(userId, workspaces)).toBe(false);

      await erasure.eraseWorkspaces(userId, workspaces);
      // What the users module does next; every remaining edge cascades.
      await dataSource.query(`DELETE FROM "user" WHERE "id" = $1`, [userId]);

      expect(await count('organization', `"id" = $1`, [workspaceId])).toBe(0);
      expect(await count('work_session', `"id" = $1`, [sessionId])).toBe(0);
      expect(await count('work_session_event', `"sessionId" = $1`, [sessionId])).toBe(0);
      expect(await count('session_checkout', `"sessionId" = $1`, [sessionId])).toBe(0);
      expect(await count('project', `"organizationId" = $1`, [workspaceId])).toBe(0);
      expect(await count('github_installation', `"organizationId" = $1`, [workspaceId])).toBe(0);
      expect(await count('host', `"ownerUserId" = $1`, [userId])).toBe(0);
      expect(await count('session', `"userId" = $1`, [userId])).toBe(0);
      expect(await count('account', `"userId" = $1`, [userId])).toBe(0);
    });

    it('leaves a workspace somebody else is in, and what they hold', async () => {
      const leaving = await insertUser();
      const staying = await insertUser();
      const personal = await insertWorkspace(leaving);
      const shared = await insertWorkspace(leaving, staying);
      const theirs = await insertWork(shared, staying);

      const workspaces = await erasure.findSoleWorkspaces(leaving);
      expect(workspaces).toEqual([personal]);
      expect(await erasure.hasSharedWork(leaving, workspaces)).toBe(false);

      await erasure.eraseWorkspaces(leaving, workspaces);

      expect(await count('organization', `"id" = $1`, [shared])).toBe(1);
      expect(await count('work_session', `"id" = $1`, [theirs])).toBe(1);
    });

    it('reports work left in a shared workspace', async () => {
      const leaving = await insertUser();
      const staying = await insertUser();
      const personal = await insertWorkspace(leaving);
      const shared = await insertWorkspace(leaving, staying);
      await insertWork(shared, leaving);

      expect(await erasure.hasSharedWork(leaving, [personal])).toBe(true);
    });
  });

  describe('username', () => {
    it('is unique across accounts, under the constraint the repository maps', async () => {
      const handle = `adri-${randomUUID().slice(0, 6)}`;
      await insertUser(handle);

      await expect(insertUser(handle)).rejects.toMatchObject({
        driverError: expect.objectContaining({ code: '23505', constraint: 'UQ_user_username' }),
      });
    });

    it.each(['Adri', '-adri', 'adri-', 'ad--ri', 'adri_parra'])('refuses %s', async (handle) => {
      await expect(insertUser(handle)).rejects.toMatchObject({
        driverError: expect.objectContaining({ constraint: 'CHK_user_username' }),
      });
    });

    it('lets any number of accounts have none', async () => {
      await insertUser(null);
      await expect(insertUser(null)).resolves.toBeDefined();
    });
  });
});
