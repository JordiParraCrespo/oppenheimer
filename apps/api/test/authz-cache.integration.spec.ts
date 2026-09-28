import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { CacheService } from '@oppenheimer/backend-cache';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from './run-migrations';

/**
 * The authorization cache against a real Postgres and Redis: how many queries a
 * guarded request costs, and that every writer that changes effective
 * permissions is visible on the very next request.
 *
 * Queries are counted through TypeORM's logger, filtered to the tables
 * authorization reads. Better Auth's `getSession` runs on its own `pg` pool and
 * is not counted: it is the same before and after.
 *
 * The route is `GET /v1/projects` — `ApiAuthGuard` + `PoliciesGuard` +
 * `AccessScopeInterceptor`, `read Project` — which the workspace owner can
 * read and a plain account cannot.
 */
describe('authorization cache (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;
  let commandBus: CommandBus;
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  /** Every SQL statement TypeORM ran, while recording. */
  let recorded: string[] | null = null;

  let user: { id: string; token: string; workspaceId: string };

  beforeAll(async () => {
    [pgContainer, redisContainer] = await Promise.all([
      new GenericContainer('postgres:16-alpine')
        .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start(),
      new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
    ]);

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = pgContainer.getHost();
    process.env.DB_PORT = pgContainer.getMappedPort(5432).toString();
    process.env.DB_USERNAME = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_DATABASE = 'test';
    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString();
    process.env.BETTER_AUTH_SECRET = 'integration-test-secret-value-32-chars';

    await runAllMigrations();

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });

    const { VersioningType } = await import('@nestjs/common');
    const { SanitizePipe } = await import('@oppenheimer/backend-core');
    const { ZodValidationPipe } = await import('nestjs-zod');
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    dataSource = moduleRef.get(DataSource);
    commandBus = moduleRef.get(CommandBus);

    // Record every statement TypeORM sends, whatever `logging` says: the query
    // runner calls `logQuery` unconditionally and the logger decides.
    const logger = dataSource.logger;
    const logQuery = logger.logQuery.bind(logger);
    logger.logQuery = (query, parameters, queryRunner) => {
      recorded?.push(query);
      return logQuery(query, parameters, queryRunner);
    };

    user = await signUp(`owner-${randomUUID().slice(0, 8)}@example.com`);
  }, 180000);

  afterAll(async () => {
    await app?.close();
    const { emailQueue } = await import('../src/auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  // --- helpers -------------------------------------------------------------

  /** Sign up, then wait for sign-up's personal workspace to reach the session. */
  async function signUp(email: string) {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Integration-test-password-1',
        name: 'Integration Owner',
        firstName: 'Integration',
        lastName: 'Owner',
      }),
    });
    expect(response.ok).toBe(true);
    const token = response.headers.get('set-auth-token') as string;
    const { user: created } = (await response.json()) as { user: { id: string } };

    // Provisioning runs after sign-up commits, and moves the open session into
    // the workspace it creates.
    let workspaceId = '';
    await vi.waitFor(
      async () => {
        const [row] = await dataSource.query(
          `SELECT "activeOrganizationId" FROM "session" WHERE "userId" = $1`,
          [created.id],
        );
        expect(row?.activeOrganizationId).toBeTruthy();
        workspaceId = row.activeOrganizationId;
      },
      { timeout: 15000, interval: 100 },
    );
    return { id: created.id, token, workspaceId };
  }

  /** Point the caller's session at `organizationId`: the request's tenant. */
  async function actIn(organizationId: string) {
    await dataSource.query(`UPDATE "session" SET "activeOrganizationId" = $1 WHERE "userId" = $2`, [
      organizationId,
      user.id,
    ]);
  }

  async function newOrganization(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [id, `acme-${id.slice(0, 8)}`],
    );
    return id;
  }

  const listProjects = async () =>
    (
      await fetch(`${baseUrl}/api/v1/projects`, {
        headers: { accept: 'application/json', authorization: `Bearer ${user.token}` },
      })
    ).status;

  /** The authorization tables each recorded statement reads. */
  const TABLES = {
    versions: /"role_catalog_version"/,
    user_role: /(FROM|JOIN)\s+"user_role"/i,
    role: /(FROM|JOIN)\s+"role"/i,
    teamMember: /(FROM|JOIN)\s+"teamMember"/i,
    team: /(FROM|JOIN)\s+"team"/i,
    access_grant: /(FROM|JOIN)\s+"access_grant"/i,
  } as const;

  /** Run `work`, and count the authorization queries it sent. */
  async function counting(work: () => Promise<unknown>) {
    recorded = [];
    await work();
    const statements = recorded;
    recorded = null;
    const authz = statements.filter((sql) => Object.values(TABLES).some((re) => re.test(sql)));
    const byTable = Object.fromEntries(
      Object.entries(TABLES).map(([name, re]) => [
        name,
        authz.filter((sql) => re.test(sql)).length,
      ]),
    ) as Record<keyof typeof TABLES, number>;
    return { total: authz.length, ...byTable };
  }

  const permissionsOf = async (name: string) =>
    (
      await dataSource.query(
        `SELECT "id", "permissions" FROM "role" WHERE "name" = $1 AND "organizationId" IS NULL`,
        [name],
      )
    )[0] as { id: string; permissions: unknown[] };

  // --- query count ---------------------------------------------------------

  describe('queries per guarded request', () => {
    beforeAll(async () => {
      await actIn(user.workspaceId);
      await app.get(CacheService).reset();
    });

    it('reads user_role once cold, and not at all warm', async () => {
      let status = 0;
      const cold = await counting(async () => {
        status = await listProjects();
      });
      expect(status).toBe(200);
      const warm = await counting(async () => {
        status = await listProjects();
      });
      expect(status).toBe(200);

      console.info('authz queries per GET /v1/projects', { cold, warm });

      // Cold: the versions, the role set (user_role + role), the platform role
      // snapshot (role), then the team join and the grants.
      expect(cold.user_role).toBe(1);
      // Warm: one query in the guard (the versions), two in the interceptor.
      expect(warm).toEqual({
        total: 3,
        versions: 1,
        user_role: 0,
        role: 0,
        teamMember: 1,
        team: 1,
        access_grant: 1,
      });
    });
  });

  // --- invalidation --------------------------------------------------------

  describe('every writer is visible on the next request', () => {
    let organizationId: string;

    const readProjects = [
      {
        action: 'read',
        subject: 'Project',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a stored condition placeholder
        conditions: { organizationId: '${activeOrganizationId}' },
      },
    ];

    beforeEach(async () => {
      // An organization the caller holds nothing in: only their global roles
      // apply, and `user` does not read projects.
      organizationId = await newOrganization();
      await actIn(organizationId);
      expect(await listProjects()).toBe(403);
    });

    async function orgRoleHeld(permissions: unknown[]) {
      const { CreateRoleCommand } = await import(
        '../src/roles/commands/create-role/create-role.command'
      );
      const { AssignUserRolesCommand } = await import(
        '../src/roles/commands/assign-user-roles/assign-user-roles.command'
      );
      const roleId = await commandBus.execute(
        new CreateRoleCommand({
          name: `reviewer-${randomUUID().slice(0, 8)}`,
          permissions: permissions as never,
          organizationId,
        }),
      );
      await commandBus.execute(
        new AssignUserRolesCommand({
          userId: user.id,
          roleIds: [roleId as string],
          organizationId,
        }),
      );
      return roleId as string;
    }

    it('an org role losing a permission', async () => {
      const roleId = await orgRoleHeld(readProjects);
      expect(await listProjects()).toBe(200);
      expect(await listProjects()).toBe(200); // warm

      const { UpdateRolePermissionsCommand } = await import(
        '../src/roles/commands/update-role-permissions/update-role-permissions.command'
      );
      await commandBus.execute(
        new UpdateRolePermissionsCommand({ roleId, permissions: [], organizationId }),
      );

      expect(await listProjects()).toBe(403);
    });

    it('an org role deleted', async () => {
      const roleId = await orgRoleHeld(readProjects);
      expect(await listProjects()).toBe(200);

      const { DeleteRoleCommand } = await import(
        '../src/roles/commands/delete-role/delete-role.command'
      );
      await commandBus.execute(new DeleteRoleCommand({ roleId, organizationId }));

      expect(await listProjects()).toBe(403);
    });

    it('a member removed, then given a membership role', async () => {
      await orgRoleHeld(readProjects);
      expect(await listProjects()).toBe(200);

      const { USER_ROLE_REPOSITORY } = await import('../src/roles/roles.di-tokens');
      const userRoles = app.get(USER_ROLE_REPOSITORY);
      await userRoles.setRolesForUser(user.id, [], organizationId);
      expect(await listProjects()).toBe(403);

      const owner = await permissionsOf('owner');
      await userRoles.replaceMembershipRole(user.id, organizationId, owner.id);
      expect(await listProjects()).toBe(200);
    });

    it('a global role edited, seen by this process and by another replica', async () => {
      const { AbilityFactory } = await import('../src/roles/application/ability.factory');
      const { GlobalRoleRegistry } = await import('../src/roles/application/global-role.registry');
      const { AUTHZ_VERSION_REPOSITORY, ROLE_REPOSITORY, USER_ROLE_REPOSITORY } = await import(
        '../src/roles/roles.di-tokens'
      );
      // Another replica: its own factory and its own snapshot of global roles.
      const replica = new AbilityFactory(
        app.get(USER_ROLE_REPOSITORY),
        app.get(AUTHZ_VERSION_REPOSITORY),
        new GlobalRoleRegistry(app.get(ROLE_REPOSITORY)),
        app.get(CacheService),
      );
      const principal = { id: user.id, role: 'user' };
      const replicaCanRead = async () =>
        (await replica.createForUser(principal, { organizationId })).can('read', 'Project');
      expect(await replicaCanRead()).toBe(false);

      const { UpdateRolePermissionsCommand } = await import(
        '../src/roles/commands/update-role-permissions/update-role-permissions.command'
      );
      const role = await permissionsOf('user');
      await commandBus.execute(
        new UpdateRolePermissionsCommand({
          roleId: role.id,
          permissions: [...role.permissions, ...readProjects] as never,
          organizationId: null,
        }),
      );

      try {
        expect(await listProjects()).toBe(200);
        expect(await replicaCanRead()).toBe(true);
      } finally {
        await commandBus.execute(
          new UpdateRolePermissionsCommand({
            roleId: role.id,
            permissions: role.permissions as never,
            organizationId: null,
          }),
        );
      }

      expect(await listProjects()).toBe(403);
      expect(await replicaCanRead()).toBe(false);
    });

    it('a global assignment replaced (`PUT /users/:id/roles` with no tenant)', async () => {
      const { CreateRoleCommand } = await import(
        '../src/roles/commands/create-role/create-role.command'
      );
      const { AssignUserRolesCommand } = await import(
        '../src/roles/commands/assign-user-roles/assign-user-roles.command'
      );
      const globalRoleId = (await commandBus.execute(
        new CreateRoleCommand({
          name: `global-reader-${randomUUID().slice(0, 8)}`,
          permissions: readProjects as never,
          organizationId: null,
        }),
      )) as string;
      const userRole = await permissionsOf('user');
      expect(await listProjects()).toBe(403); // warm, without it

      await commandBus.execute(
        new AssignUserRolesCommand({ userId: user.id, roleIds: [userRole.id, globalRoleId] }),
      );
      expect(await listProjects()).toBe(200);

      await commandBus.execute(
        new AssignUserRolesCommand({ userId: user.id, roleIds: [userRole.id] }),
      );
      expect(await listProjects()).toBe(403);
    });
  });
});
