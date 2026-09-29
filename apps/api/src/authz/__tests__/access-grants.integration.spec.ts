import { randomUUID } from 'node:crypto';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, type Logger } from 'typeorm';
import { loadMigrations } from '../../__tests__/run-migrations';
import { AccessGrantMapper } from '../authz.mapper';
import { AccessGrantOrmEntity } from '../database/access-grant.orm-entity';
import { AccessGrantRepository } from '../database/access-grant.repository';

/**
 * `AccessGrantRepository` against the migrated schema: the scope resolver's
 * principal lookup, which must be one statement shape whatever the number of
 * principals, and the organization's paginated list.
 */
describe('AccessGrantRepository (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let grants: AccessGrantRepository;
  const statements: string[] = [];
  const parametersOf = new Map<string, unknown[]>();

  const ids = {
    organization: randomUUID(),
    otherOrganization: randomUUID(),
    user: randomUUID(),
    otherUser: randomUUID(),
    team: randomUUID(),
    role: randomUUID(),
    grantedBy: randomUUID(),
  };

  /** Records every statement TypeORM sends, for the SQL-shape assertion. */
  const logger: Logger = {
    logQuery: (query, parameters) => {
      statements.push(query);
      parametersOf.set(query, parameters ?? []);
    },
    logQueryError: () => {},
    logQuerySlow: () => {},
    logSchemaBuild: () => {},
    logMigration: () => {},
    log: () => {},
  };

  const insertGrant = (
    organizationId: string,
    principalType: string,
    principalId: string,
    resourceId: string,
    expiresAt: string | null = null,
    createdAt = 'now()',
  ) =>
    dataSource.query(
      `INSERT INTO "access_grant" ("organizationId", "principalType", "principalId",
                                   "resourceType", "resourceId", "grantedBy", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, 'Project', $4, $5, $6, ${createdAt})`,
      [organizationId, principalType, principalId, resourceId, ids.grantedBy, expiresAt],
    );

  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    dataSource = new DataSource({
      type: 'postgres',
      url: `postgres://test:test@${pgContainer.getHost()}:${pgContainer.getMappedPort(5432)}/test`,
      entities: [AccessGrantOrmEntity],
      migrations: await loadMigrations(),
      logger,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    grants = new AccessGrantRepository(
      dataSource.getRepository(AccessGrantOrmEntity),
      new AccessGrantMapper(),
    );

    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug")
       VALUES ($1, 'Grants', 'grants'), ($2, 'Elsewhere', 'elsewhere')`,
      [ids.organization, ids.otherOrganization],
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  describe('findActiveForPrincipals', () => {
    const resources = {
      user: randomUUID(),
      team: randomUUID(),
      role: randomUUID(),
      expired: randomUUID(),
      otherUser: randomUUID(),
      otherOrganization: randomUUID(),
      future: randomUUID(),
    };

    beforeAll(async () => {
      await insertGrant(ids.organization, 'user', ids.user, resources.user);
      await insertGrant(ids.organization, 'team', ids.team, resources.team);
      await insertGrant(ids.organization, 'role', ids.role, resources.role);
      await insertGrant(
        ids.organization,
        'user',
        ids.user,
        resources.future,
        new Date(Date.now() + 3_600_000).toISOString(),
      );
      await insertGrant(
        ids.organization,
        'user',
        ids.user,
        resources.expired,
        new Date(Date.now() - 3_600_000).toISOString(),
      );
      await insertGrant(ids.organization, 'user', ids.otherUser, resources.otherUser);
      await insertGrant(ids.otherOrganization, 'user', ids.user, resources.otherOrganization);
      // The same id under another principal type must not match: the pair is
      // what is compared, not each column on its own.
      await insertGrant(ids.organization, 'team', ids.user, randomUUID());
    });

    const resourceIdsOf = (rows: { resourceId: string | null }[]) =>
      rows.map((row) => row.resourceId).sort();

    it('returns the unexpired grants of one principal in the organization', async () => {
      const rows = await grants.findActiveForPrincipals(ids.organization, [
        { principalType: 'user', principalId: ids.user },
      ]);

      expect(resourceIdsOf(rows)).toEqual([resources.user, resources.future].sort());
    });

    it('returns the union for a user, their team and their role', async () => {
      const rows = await grants.findActiveForPrincipals(ids.organization, [
        { principalType: 'user', principalId: ids.user },
        { principalType: 'team', principalId: ids.team },
        { principalType: 'role', principalId: ids.role },
      ]);

      expect(resourceIdsOf(rows)).toEqual(
        [resources.user, resources.future, resources.team, resources.role].sort(),
      );
    });

    it('sends the same SQL text for one principal and for five', async () => {
      const principals = [
        { principalType: 'user', principalId: ids.user },
        { principalType: 'team', principalId: ids.team },
        { principalType: 'role', principalId: ids.role },
        { principalType: 'team', principalId: randomUUID() },
        { principalType: 'role', principalId: randomUUID() },
      ];

      statements.length = 0;
      await grants.findActiveForPrincipals(ids.organization, principals.slice(0, 1));
      await grants.findActiveForPrincipals(ids.organization, principals);

      const lookups = statements.filter((sql) => sql.includes('unnest'));
      expect(lookups).toHaveLength(2);
      expect(lookups[0]).toBe(lookups[1]);
    });

    it('can be served by IDX_access_grant_lookup', async () => {
      statements.length = 0;
      await grants.findActiveForPrincipals(ids.organization, [
        { principalType: 'user', principalId: ids.user },
        { principalType: 'team', principalId: ids.team },
      ]);
      const [sql] = statements.filter((statement) => statement.includes('unnest'));
      // Too few rows for the planner to prefer an index on its own.
      const plan: { 'QUERY PLAN': string }[] = await dataSource.transaction(async (manager) => {
        await manager.query('SET LOCAL enable_seqscan = off');
        return manager.query(`EXPLAIN ${sql}`, parametersOf.get(sql));
      });

      expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain('IDX_access_grant_lookup');
    });

    it('asks nothing for no principals', async () => {
      statements.length = 0;
      await expect(grants.findActiveForPrincipals(ids.organization, [])).resolves.toEqual([]);
      expect(statements).toEqual([]);
    });
  });

  describe('findPageInOrganization', () => {
    const organizationId = randomUUID();

    beforeAll(async () => {
      await dataSource.query(
        `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Paged', 'paged')`,
        [organizationId],
      );
      for (let hour = 0; hour < 5; hour++) {
        await insertGrant(
          organizationId,
          'user',
          ids.user,
          randomUUID(),
          null,
          `now() - interval '${hour} hours'`,
        );
      }
    });

    it('returns one page, newest first, with the total', async () => {
      const first = await grants.findPageInOrganization(organizationId, { page: 1, limit: 2 });
      const last = await grants.findPageInOrganization(organizationId, { page: 3, limit: 2 });

      expect(first.count).toBe(5);
      expect(first.data).toHaveLength(2);
      expect(last.data).toHaveLength(1);
      const created = first.data.map((grant) => grant.createdAt.getTime());
      expect(created[0]).toBeGreaterThan(created[1]);
      expect(created[1]).toBeGreaterThan(last.data[0].createdAt.getTime());
    });

    it('never reads another organization', async () => {
      const page = await grants.findPageInOrganization(organizationId, { page: 1, limit: 100 });

      expect(page.data.every((grant) => grant.organizationId === organizationId)).toBe(true);
    });
  });
});
