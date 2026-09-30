import { OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { GithubInstallationOrmEntity } from '../database/github-installation.orm-entity';
import { GithubInstallationRepository } from '../database/github-installation.repository';
import { GithubInstallationMapper } from '../github-installation.mapper';

/**
 * The GitHub installation tables, against a real Postgres.
 *
 * This is the layer unit tests cannot reach: constraint names, the check
 * constraint, the composite unique a later slice's foreign key depends on, and
 * the owner role's rule — none of which a mock can be wrong about.
 *
 * It deliberately does not boot the application: what is under test is SQL.
 */
describe('GitHub installations schema (integration)', () => {
  let container: StartedTestContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = container.getMappedPort(5432).toString();
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
      entities: [GithubInstallationOrmEntity],
    });
    await dataSource.initialize();
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  const ORG_ONE = '11111111-1111-4111-8111-111111111111';
  const ORG_TWO = '22222222-2222-4222-8222-222222222222';
  const USER = '33333333-3333-4333-8333-333333333333';

  async function seedTenants(): Promise<void> {
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
         VALUES ($1, 'Ana', 'ana@example.com', 'Ana', 'Díaz')
         ON CONFLICT ("id") DO NOTHING`,
      [USER],
    );
    for (const [id, slug] of [
      [ORG_ONE, 'acme'],
      [ORG_TWO, 'rival'],
    ]) {
      await dataSource.query(
        `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, $2, $2)
           ON CONFLICT ("id") DO NOTHING`,
        [id, slug],
      );
    }
  }

  async function connect(organizationId: string, githubInstallationId: number) {
    return dataSource.query(
      `INSERT INTO "github_installation"
         ("organizationId", "githubInstallationId", "accountLogin", "accountType",
          "repositorySelection", "installedByUserId")
       VALUES ($1, $2, 'acme-labs', 'Organization', 'selected', $3)`,
      [organizationId, githubInstallationId, USER],
    );
  }

  describe('github_installation', () => {
    beforeAll(seedTenants);

    it('has the columns the ORM entity declares', async () => {
      const columns: { column_name: string; data_type: string; is_nullable: string }[] =
        await dataSource.query(
          `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
            WHERE table_name = 'github_installation'`,
        );
      const byName = new Map(columns.map((column) => [column.column_name, column]));

      expect([...byName.keys()].sort()).toEqual([
        'accountLogin',
        'accountType',
        'createdAt',
        'deletedAt',
        'githubInstallationId',
        'id',
        'installedByUserId',
        'organizationId',
        'repositorySelection',
        'statusChangedAt',
        'suspendedAt',
        'updatedAt',
      ]);
      // A bigint, because GitHub's ids are not ours to bound.
      expect(byName.get('githubInstallationId')?.data_type).toBe('bigint');
      // Nullable, because "suspended" and "uninstalled" are states of a row that
      // stays: a checkout that named this installation still needs it to resolve.
      expect(byName.get('suspendedAt')?.is_nullable).toBe('YES');
      expect(byName.get('deletedAt')?.is_nullable).toBe('YES');
    });

    it('refuses a second workspace claiming an installation the first still holds', async () => {
      await connect(ORG_ONE, 10000001);

      // This is the constraint behind the 409: without it two workspaces would
      // both mint tokens for the same repositories.
      await expect(connect(ORG_TWO, 10000001)).rejects.toThrow(
        /UQ_github_installation_live_github_id/,
      );
    });

    it('frees the installation once the workspace disconnects', async () => {
      await connect(ORG_ONE, 10000004);
      await dataSource.query(
        `UPDATE "github_installation" SET "deletedAt" = now()
          WHERE "githubInstallationId" = 10000004`,
      );

      // A claim is what a workspace holds, not what it once touched. The
      // disconnected row stays as history and stops occupying the number, so
      // GITHUB_003 cannot come to mean "somebody once connected this".
      await connect(ORG_TWO, 10000004);
      const rows: { count: string }[] = await dataSource.query(
        `SELECT count(*) FROM "github_installation" WHERE "githubInstallationId" = 10000004`,
      );
      expect(Number(rows[0].count)).toBe(2);
    });

    it('carries the composite unique a checkout’s foreign key will need', async () => {
      const constraints: { constraint_name: string }[] = await dataSource.query(
        `SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = 'github_installation' AND constraint_type = 'UNIQUE'`,
      );
      // The live-claim uniqueness is a partial index, not a table constraint, so
      // it is deliberately absent from this list.
      expect(constraints.map((c) => c.constraint_name)).toEqual([
        'UQ_github_installation_organization_id',
      ]);
    });

    it('refuses values GitHub would never send', async () => {
      const insert = (selection: string, accountType: string) =>
        dataSource.query(
          `INSERT INTO "github_installation"
             ("organizationId", "githubInstallationId", "accountLogin", "accountType",
              "repositorySelection", "installedByUserId")
           VALUES ($1, 10000002, 'acme-labs', $3, $4, $2)`,
          [ORG_ONE, USER, accountType, selection],
        );

      await expect(insert('some', 'Organization')).rejects.toThrow(
        /CHK_github_installation_repository_selection/,
      );
      await expect(insert('all', 'Enterprise')).rejects.toThrow(
        /CHK_github_installation_account_type/,
      );
    });

    it('keeps the workspace’s access when the person who connected it is deleted', async () => {
      const other = '44444444-4444-4444-8444-444444444444';
      await dataSource.query(
        `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
           VALUES ($1, 'Bea', 'bea@example.com', 'Bea', 'Ruiz')`,
        [other],
      );
      await dataSource.query(
        `INSERT INTO "github_installation"
           ("organizationId", "githubInstallationId", "accountLogin", "accountType",
            "repositorySelection", "installedByUserId")
         VALUES ($1, 10000005, 'acme-labs', 'Organization', 'all', $2)`,
        [ORG_ONE, other],
      );

      // `installedByUserId` is audit, not ownership: the installation belongs to
      // the organization, so deleting the person who clicked Connect must not
      // take the workspace's GitHub access — and every checkout naming it — away.
      await expect(dataSource.query('DELETE FROM "user" WHERE "id" = $1', [other])).rejects.toThrow(
        /FK_github_installation_installed_by/,
      );
    });

    it('lets a webhook change a live row and never a disconnected one', async () => {
      await connect(ORG_ONE, 10000006);
      // The exact shape the webhook handler writes.
      const statusChange = (suspended: string) =>
        dataSource.query(
          `UPDATE "github_installation" SET "suspendedAt" = ${suspended}, "updatedAt" = now()
            WHERE "githubInstallationId" = 10000006 AND "deletedAt" IS NULL`,
        );

      await statusChange('now()');
      await dataSource.query(
        `UPDATE "github_installation" SET "deletedAt" = now()
          WHERE "githubInstallationId" = 10000006`,
      );
      // An unsuspend that arrives after a disconnect matches nothing, so it
      // cannot resurrect the claim. A load-mutate-save of the whole aggregate
      // would have written `deletedAt` back to null.
      await statusChange('NULL');

      const [row] = await dataSource.query(
        `SELECT "suspendedAt", "deletedAt" FROM "github_installation"
          WHERE "githubInstallationId" = 10000006`,
      );
      expect(row.deletedAt).not.toBeNull();
      expect(row.suspendedAt).not.toBeNull();
    });

    describe("ordered by GitHub's time", () => {
      const T1 = new Date('2026-09-01T09:00:00Z');
      const T2 = new Date('2026-09-01T10:00:00Z');

      function repository() {
        return new GithubInstallationRepository(
          dataSource.getRepository(GithubInstallationOrmEntity),
          new GithubInstallationMapper(),
          new OutboxService(dataSource),
        );
      }

      async function statusOf(githubInstallationId: number) {
        const [row] = await dataSource.query(
          `SELECT "suspendedAt", "deletedAt", "statusChangedAt" FROM "github_installation"
            WHERE "githubInstallationId" = $1`,
          [githubInstallationId],
        );
        return row as { suspendedAt: Date | null; deletedAt: Date | null; statusChangedAt: Date };
      }

      it('ignores a late suspend older than the unsuspend already applied', async () => {
        await connect(ORG_ONE, 10000010);
        const installations = repository();

        await expect(
          installations.applyStatusChange({
            githubInstallationId: 10000010,
            occurredAt: T2,
            suspendedAt: null,
          }),
        ).resolves.toBe('applied');
        // Regression: the retry of the older suspend used to win, and the
        // installation stayed suspended.
        await expect(
          installations.applyStatusChange({
            githubInstallationId: 10000010,
            occurredAt: T1,
            suspendedAt: T1,
          }),
        ).resolves.toBe('stale');

        const row = await statusOf(10000010);
        expect(row.suspendedAt).toBeNull();
        expect(row.statusChangedAt).toEqual(T2);
      });

      it('applies changes that arrive in order, with the time GitHub gave', async () => {
        await connect(ORG_ONE, 10000011);
        await connect(ORG_ONE, 10000012);
        const installations = repository();

        await installations.applyStatusChange({
          githubInstallationId: 10000011,
          occurredAt: T1,
          suspendedAt: T1,
        });
        await installations.applyStatusChange({
          githubInstallationId: 10000011,
          occurredAt: T2,
          suspendedAt: null,
        });
        expect((await statusOf(10000011)).suspendedAt).toBeNull();

        await installations.applyStatusChange({
          githubInstallationId: 10000012,
          occurredAt: T1,
          suspendedAt: null,
        });
        await installations.applyStatusChange({
          githubInstallationId: 10000012,
          occurredAt: T2,
          suspendedAt: T2,
        });
        expect((await statusOf(10000012)).suspendedAt).toEqual(T2);
      });

      it('uninstalls whatever the last suspend said, and reports a missing row', async () => {
        await connect(ORG_ONE, 10000013);
        const installations = repository();
        await installations.applyStatusChange({
          githubInstallationId: 10000013,
          occurredAt: T2,
          suspendedAt: T2,
        });

        await expect(
          installations.applyStatusChange({
            githubInstallationId: 10000013,
            occurredAt: T1,
            deletedAt: new Date(),
          }),
        ).resolves.toBe('applied');
        expect((await statusOf(10000013)).deletedAt).not.toBeNull();

        // A disconnected row is history: nothing matches, and it says so.
        await expect(
          installations.applyStatusChange({
            githubInstallationId: 10000013,
            occurredAt: new Date('2026-09-02T00:00:00Z'),
            suspendedAt: null,
          }),
        ).resolves.toBe('missing');
        await expect(
          installations.applyStatusChange({
            githubInstallationId: 99999999,
            occurredAt: T1,
            suspendedAt: T1,
          }),
        ).resolves.toBe('missing');
      });
    });

    it('goes away with the workspace that claimed it', async () => {
      await connect(ORG_TWO, 10000003);
      await dataSource.query('DELETE FROM "organization" WHERE "id" = $1', [ORG_TWO]);

      const rows = await dataSource.query(
        'SELECT 1 FROM "github_installation" WHERE "organizationId" = $1',
        [ORG_TWO],
      );
      expect(rows).toEqual([]);
    });
  });

  describe('installation role permissions', () => {
    it('gives the workspace owner role its installations, and no repository rule', async () => {
      const [owner]: {
        permissions: { action: string; subject: string; conditions?: unknown }[];
      }[] = await dataSource.query(
        `SELECT "permissions" FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL`,
      );

      expect(owner.permissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'manage', subject: 'Installation' }),
        ]),
      );
      // There is no repository row anywhere, so there is no subject for one: the
      // listing routes sit on `read Installation`.
      expect(owner.permissions.some((rule) => rule.subject === 'Repository')).toBe(false);
    });

    it('narrows the rule to the active workspace', async () => {
      const [owner]: { permissions: { subject: string; conditions?: Record<string, string> }[] }[] =
        await dataSource.query(
          `SELECT "permissions" FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL`,
        );

      const rule = owner.permissions.find((candidate) => candidate.subject === 'Installation');
      // Unconditional, this rule would let anyone who created a workspace reach
      // every other workspace's installations while that one was selected.
      expect(rule?.conditions).toEqual({
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the stored placeholder, interpolated when the ability is built
        organizationId: '${activeOrganizationId}',
      });
    });
  });
});
