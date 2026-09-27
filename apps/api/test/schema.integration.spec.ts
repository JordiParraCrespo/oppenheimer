import { randomUUID } from 'node:crypto';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { loadMigrations } from './run-migrations';

/**
 * Rules the schema holds as a whole, checked on the schema the migration chain
 * builds — not on the entities, which are one of several things that write it.
 * A migration's raw SQL and the outbox's `EntitySchema` land in the same
 * catalogue, so this is the only place that sees all of them at once.
 *
 * `HardenAuthTables` is also reverted and re-applied with rows in place, so its
 * `down()` is proven and so is the clean-up its `up()` does on a database that
 * already holds sessions pointing at rows that are gone and duplicate
 * accounts. `FK_session_user` and `FK_account_user` belong to the migration
 * before it (`CascadeSignInsWithTheirUser`) and stay through the revert.
 *
 * The suite starts its own Postgres 16 container. Where Docker is not
 * available, `SCHEMA_TEST_DATABASE_URL` points it at a database you started
 * yourself instead (`postgres://user:pass@host:port/db`). That database must be
 * empty and disposable: the suite migrates it, writes rows and reverts
 * migrations.
 */
describe('the migrated schema (integration)', () => {
  let pgContainer: StartedTestContainer | undefined;
  let dataSource: DataSource;

  beforeAll(async () => {
    const external = process.env.SCHEMA_TEST_DATABASE_URL;
    let url = external;
    if (!url) {
      pgContainer = await new GenericContainer('postgres:16-alpine')
        .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      url = `postgres://test:test@${pgContainer.getHost()}:${pgContainer.getMappedPort(5432)}/test`;
    }

    dataSource = new DataSource({ type: 'postgres', url, migrations: await loadMigrations() });
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  /** Every row of a catalog query, keyed by its `name` column. */
  const byName = async <Row extends { name: string }>(sql: string) =>
    new Map<string, Row>(((await dataSource.query(sql)) as Row[]).map((row) => [row.name, row]));

  const foreignKeys = () =>
    byName<{ name: string; onDelete: string; valid: boolean }>(
      `SELECT conname AS name, confdeltype AS "onDelete", convalidated AS valid
         FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`,
    );

  const indexes = () =>
    byName<{ name: string; valid: boolean; unique: boolean }>(
      `SELECT c.relname AS name, i.indisvalid AS valid, i.indisunique AS "unique"
         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relnamespace = 'public'::regnamespace`,
    );

  const expectHardenedAuthTables = async () => {
    const keys = await foreignKeys();
    // confdeltype: c = CASCADE, n = SET NULL.
    expect(keys.get('FK_session_user')).toMatchObject({ onDelete: 'c', valid: true });
    expect(keys.get('FK_session_impersonatedBy')).toMatchObject({ onDelete: 'c', valid: true });
    expect(keys.get('FK_session_activeOrganization')).toMatchObject({ onDelete: 'n', valid: true });
    expect(keys.get('FK_session_activeTeam')).toMatchObject({ onDelete: 'n', valid: true });
    expect(keys.get('FK_account_user')).toMatchObject({ onDelete: 'c', valid: true });

    const index = await indexes();
    for (const name of [
      'PK_user',
      'UQ_user_email',
      'PK_session',
      'UQ_session_token',
      'IDX_session_userId',
      'IDX_session_impersonatedBy',
      'IDX_session_activeOrganizationId',
      'IDX_session_activeTeamId',
      'PK_account',
      'IDX_account_userId',
      'UQ_account_providerId_accountId',
      'PK_verification',
      'IDX_verification_identifier_createdAt',
      'IDX_verification_expiresAt',
      'IDX_invitation_inviterId',
      'IDX_invitation_teamId',
    ]) {
      expect(index.get(name), name).toMatchObject({ valid: true });
    }
    expect(index.get('UQ_account_providerId_accountId')?.unique).toBe(true);
  };

  // A zoneless value reaches a client with no offset and is read as local time,
  // so every date would be out by the reader's offset (#61).
  it('stores every point in time as timestamptz', async () => {
    const zoneless = await dataSource.query(
      `SELECT table_name || '.' || column_name AS "column"
         FROM information_schema.columns
        WHERE table_schema = current_schema() AND data_type = 'timestamp without time zone'
        ORDER BY 1`,
    );
    expect(zoneless).toEqual([]);
  });

  it('keys and indexes the auth tables', async () => {
    await expectHardenedAuthTables();
  });

  describe('the auth keys at work', () => {
    const ids = {
      user: randomUUID(),
      admin: randomUUID(),
      organization: randomUUID(),
      team: randomUUID(),
      session: randomUUID(),
      impersonation: randomUUID(),
    };

    beforeAll(async () => {
      await dataSource.query(
        `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName") VALUES
           ($1, 'Ada', 'ada@example.com', 'Ada', 'L'), ($2, 'Root', 'root@example.com', 'Root', 'R')`,
        [ids.user, ids.admin],
      );
      await dataSource.query(
        `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', 'acme')`,
        [ids.organization],
      );
      await dataSource.query(
        `INSERT INTO "team" ("id", "name", "organizationId") VALUES ($1, 'General', $2)`,
        [ids.team, ids.organization],
      );
      await dataSource.query(
        `INSERT INTO "session" ("id", "userId", "token", "expiresAt", "activeOrganizationId", "activeTeamId")
         VALUES ($1, $2, 'device', now() + interval '1 day', $3, $4)`,
        [ids.session, ids.user, ids.organization, ids.team],
      );
      await dataSource.query(
        `INSERT INTO "session" ("id", "userId", "token", "expiresAt", "impersonatedBy")
         VALUES ($1, $2, 'impersonation', now() + interval '1 hour', $3)`,
        [ids.impersonation, ids.user, ids.admin],
      );
      await dataSource.query(
        `INSERT INTO "account" ("id", "userId", "accountId", "providerId")
         VALUES ($1, $2, 'gh-1', 'github')`,
        [randomUUID(), ids.user],
      );
    });

    it('refuses a second account for the same provider account', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "account" ("id", "userId", "accountId", "providerId")
           VALUES ($1, $2, 'gh-1', 'github')`,
          [randomUUID(), ids.admin],
        ),
      ).rejects.toThrow(/UQ_account_providerId_accountId/);
    });

    it('refuses a session for a user that does not exist', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "session" ("id", "userId", "token", "expiresAt")
           VALUES ($1, $2, 'ghost', now())`,
          [randomUUID(), randomUUID()],
        ),
      ).rejects.toThrow(/FK_session_user/);
    });

    it('keeps the session when its workspace goes, and ends an impersonation with its admin', async () => {
      await dataSource.query(`DELETE FROM "organization" WHERE "id" = $1`, [ids.organization]);
      const [device] = await dataSource.query(
        `SELECT "activeOrganizationId", "activeTeamId" FROM "session" WHERE "id" = $1`,
        [ids.session],
      );
      expect(device).toEqual({ activeOrganizationId: null, activeTeamId: null });

      await dataSource.query(`DELETE FROM "user" WHERE "id" = $1`, [ids.admin]);
      expect(
        await dataSource.query(`SELECT 1 FROM "session" WHERE "id" = $1`, [ids.impersonation]),
      ).toEqual([]);
    });

    it("deletes a user's sessions and accounts with the user", async () => {
      await dataSource.query(`DELETE FROM "user" WHERE "id" = $1`, [ids.user]);
      const [{ sessions, accounts }] = await dataSource.query(
        `SELECT (SELECT count(*)::int FROM "session" WHERE "userId" = $1) AS sessions,
                (SELECT count(*)::int FROM "account" WHERE "userId" = $1) AS accounts`,
        [ids.user],
      );
      expect({ sessions, accounts }).toEqual({ sessions: 0, accounts: 0 });
    });
  });

  describe('reverting and re-applying HardenAuthTables', () => {
    const HARDEN = 'HardenAuthTables1790300000000';

    /** Undoes migrations, newest first, until `HardenAuthTables` is no longer applied. */
    const revertThroughHarden = async () => {
      for (;;) {
        const [applied] = await dataSource.query(`SELECT 1 FROM "migrations" WHERE "name" = $1`, [
          HARDEN,
        ]);
        if (!applied) return;
        await dataSource.undoLastMigration();
      }
    };

    it('restores the original schema, and on re-apply cleans up what the keys forbid', async () => {
      const kept = { user: randomUUID(), session: randomUUID(), account: randomUUID() };
      const stale = {
        impersonation: randomUUID(),
        workspace: randomUUID(),
        olderAccount: randomUUID(),
      };

      await dataSource.query(
        `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
         VALUES ($1, 'Bea', 'bea@example.com', 'Bea', 'B')`,
        [kept.user],
      );
      await dataSource.query(
        `INSERT INTO "session" ("id", "userId", "token", "expiresAt")
         VALUES ($1, $2, 'bea-device', now() + interval '1 day')`,
        [kept.session, kept.user],
      );
      await dataSource.query(
        `INSERT INTO "account" ("id", "userId", "accountId", "providerId", "updatedAt")
         VALUES ($1, $2, 'gh-2', 'github', now())`,
        [kept.account, kept.user],
      );

      await revertThroughHarden();

      const keys = await foreignKeys();
      for (const name of [
        'FK_session_impersonatedBy',
        'FK_session_activeOrganization',
        'FK_session_activeTeam',
      ]) {
        expect(keys.has(name), name).toBe(false);
      }
      // CascadeSignInsWithTheirUser's, which runs before it.
      expect(keys.get('FK_session_user')).toMatchObject({ onDelete: 'c', valid: true });
      expect(keys.get('FK_account_user')).toMatchObject({ onDelete: 'c', valid: true });

      const reverted = await indexes();
      for (const name of [
        'PK_user',
        'UQ_user_email',
        'PK_session',
        'UQ_session_token',
        'IDX_session_impersonatedBy',
        'IDX_session_activeOrganizationId',
        'IDX_session_activeTeamId',
        'PK_account',
        'UQ_account_providerId_accountId',
        'PK_verification',
        'IDX_verification_identifier_createdAt',
        'IDX_verification_expiresAt',
        'IDX_invitation_inviterId',
        'IDX_invitation_teamId',
      ]) {
        expect(reverted.has(name), name).toBe(false);
      }
      for (const name of [
        'PK_cace4a159ff9f2512dd42373760',
        'UQ_e12875dfb3b1d92d7d7c5377e22',
        'PK_f55da76ac1c3ac420f444d2ff11',
        'UQ_232f8e85d7633bd6ddfad421696',
        'PK_54115ee388cdb6d86bb4bf5b2ea',
        'PK_f7e3a90ca384e71d6e2e93bb340',
        'UQ_user_username',
        'IDX_session_userId',
        'IDX_account_userId',
      ]) {
        expect(reverted.has(name), name).toBe(true);
      }

      // What the reverted schema lets in: a session impersonated by nobody, one
      // open on a workspace that does not exist, and a second row for the same
      // provider account, older than the one it duplicates. Each has a real
      // user, as FK_session_user and FK_account_user still require.
      await dataSource.query(
        `INSERT INTO "session" ("id", "userId", "token", "expiresAt", "impersonatedBy")
         VALUES ($1, $2, 'impersonated-by-nobody', now() + interval '1 day', $3)`,
        [stale.impersonation, kept.user, randomUUID()],
      );
      await dataSource.query(
        `INSERT INTO "session" ("id", "userId", "token", "expiresAt", "activeOrganizationId")
         VALUES ($1, $2, 'gone-workspace', now() + interval '1 day', $3)`,
        [stale.workspace, kept.user, randomUUID()],
      );
      await dataSource.query(
        `INSERT INTO "account" ("id", "userId", "accountId", "providerId", "updatedAt")
         VALUES ($1, $2, 'gh-2', 'github', now() - interval '1 day')`,
        [stale.olderAccount, kept.user],
      );

      await dataSource.runMigrations();
      await expectHardenedAuthTables();

      const [rows] = await dataSource.query(
        `SELECT (SELECT array_agg("id"::text ORDER BY "token") FROM "session" WHERE "id" = ANY($1)) AS sessions,
                (SELECT array_agg("id"::text) FROM "account" WHERE "id" = ANY($2)) AS accounts,
                (SELECT "activeOrganizationId" FROM "session" WHERE "id" = $3) AS "goneWorkspace"`,
        [
          [kept.session, stale.impersonation, stale.workspace],
          [kept.account, stale.olderAccount],
          stale.workspace,
        ],
      );
      // 'bea-device' sorts before 'gone-workspace'.
      expect(rows).toEqual({
        sessions: [kept.session, stale.workspace],
        accounts: [kept.account],
        goneWorkspace: null,
      });
    });
  });
});
