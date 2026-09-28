import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
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
 * `AddHotPathIndexesAndDropRedundant` is reverted and re-applied the same way,
 * and its large-table path is run with the ops scripts it points at.
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

  it('indexes the automation and session hot paths', async () => {
    await expectHotPathIndexes();
  });

  // `.agents/rules/database-design.md`: every foreign key is backed by an index
  // whose leading columns are the key's columns, or the reason it is not is
  // written down. A partial index counts only when its predicate is
  // `IS NOT NULL`, which every lookup the key makes satisfies.
  it('backs every foreign key with an index', async () => {
    const rows: { name: string }[] = await dataSource.query(
      `SELECT c.conname AS name
         FROM pg_constraint c
        WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
          AND NOT EXISTS (
            SELECT 1 FROM pg_index i
             WHERE i.indrelid = c.conrelid AND i.indisvalid
               AND (i.indpred IS NULL OR pg_get_expr(i.indpred, i.indrelid) ~ 'IS NOT NULL')
               AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
               AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)
        ORDER BY 1`,
    );
    const unindexed = rows.map((row) => row.name);
    expect(unindexed.filter((name) => !FOREIGN_KEYS_WITHOUT_THEIR_INDEX.has(name))).toEqual([]);
    // An entry whose key has since been indexed (or dropped) comes off the list.
    expect(
      [...FOREIGN_KEYS_WITHOUT_THEIR_INDEX.keys()].filter((name) => !unindexed.includes(name)),
    ).toEqual([]);
  });

  describe('reverting and re-applying AddHotPathIndexesAndDropRedundant', () => {
    const HOT_PATH = 'AddHotPathIndexesAndDropRedundant1790810000000';
    const ids = {
      user: randomUUID(),
      organization: randomUUID(),
      host: randomUUID(),
      project: randomUUID(),
      installation: randomUUID(),
      automation: randomUUID(),
      revision: randomUUID(),
      session: randomUUID(),
    };

    /** Undoes migrations, newest first, until `AddHotPathIndexesAndDropRedundant` is no longer applied. */
    const revertThroughHotPath = async () => {
      for (;;) {
        const [applied] = await dataSource.query(`SELECT 1 FROM "migrations" WHERE "name" = $1`, [
          HOT_PATH,
        ]);
        if (!applied) return;
        await dataSource.undoLastMigration();
      }
    };

    const rowCounts = async () => {
      const [counts] = await dataSource.query(
        `SELECT (SELECT count(*)::int FROM "automation_trigger" WHERE "automationId" = $1) AS triggers,
                (SELECT count(*)::int FROM "automation_run" WHERE "automationId" = $1) AS runs,
                (SELECT count(*)::int FROM "work_session_event" WHERE "sessionId" = $2) AS events,
                (SELECT count(*)::int FROM "session_checkout" WHERE "sessionId" = $2) AS checkouts`,
        [ids.automation, ids.session],
      );
      return counts;
    };

    beforeAll(async () => {
      await dataSource.query(
        `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
         VALUES ($1, 'Cy', 'cy@example.com', 'Cy', 'C')`,
        [ids.user],
      );
      await dataSource.query(
        `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Hot', 'hot-path')`,
        [ids.organization],
      );
      await dataSource.query(
        `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
         VALUES ($1, $2, 'box', 'key', 'fingerprint')`,
        [ids.host, ids.user],
      );
      await dataSource.query(
        `INSERT INTO "project" ("id", "organizationId", "name", "slug") VALUES ($1, $2, 'Web', 'web')`,
        [ids.project, ids.organization],
      );
      await dataSource.query(
        `INSERT INTO "github_installation" ("id", "organizationId", "githubInstallationId", "accountLogin",
                                            "accountType", "repositorySelection", "installedByUserId")
         VALUES ($1, $2, 4242, 'acme', 'Organization', 'all', $3)`,
        [ids.installation, ids.organization, ids.user],
      );
      // `currentRevisionId` is a deferred key: the automation and its first
      // revision are written in one transaction.
      await dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO "automation" ("id", "organizationId", "projectId", "ownerUserId", "name", "currentRevisionId")
           VALUES ($1, $2, $3, $4, 'Nightly', $5)`,
          [ids.automation, ids.organization, ids.project, ids.user, ids.revision],
        );
        await manager.query(
          `INSERT INTO "automation_revision" ("id", "organizationId", "automationId", "number", "hostId",
                                              "agent", "prompt", "repositories")
           VALUES ($1, $2, $3, 1, $4, 'claude', 'Tidy up', '[{"githubRepoId": 1}]')`,
          [ids.revision, ids.organization, ids.automation, ids.host],
        );
      });
      await dataSource.query(
        `INSERT INTO "automation_trigger" ("organizationId", "automationId", "source", "eventType", "config", "timezone")
         VALUES ($1, $2, 'schedule', 'cron', '{}', 'UTC')`,
        [ids.organization, ids.automation],
      );
      await dataSource.query(
        `INSERT INTO "work_session" ("id", "organizationId", "projectId", "createdByUserId", "hostId",
                                     "name", "slug", "agent")
         VALUES ($1, $2, $3, $4, $5, 'Tidy', 'tidy', 'claude')`,
        [ids.session, ids.organization, ids.project, ids.user, ids.host],
      );
      await dataSource.query(
        `INSERT INTO "automation_run" ("organizationId", "automationId", "revisionId", "cause", "causeKey",
                                       "outcome", "dispatchedAt", "sessionId")
         VALUES ($1, $2, $3, 'schedule', 'first', 'dispatched', now(), $4),
                ($1, $2, $3, 'schedule', 'second', 'pending', NULL, NULL)`,
        [ids.organization, ids.automation, ids.revision, ids.session],
      );
      await dataSource.query(
        `INSERT INTO "work_session_event" ("sessionId", "seq", "idempotencyKey", "source", "kind", "occurredAt")
         VALUES ($1, 1, 'first', 'api', 'prompt.first', now()), ($1, 2, 'second', 'runner', 'agent.state', now())`,
        [ids.session],
      );
      await dataSource.query(
        `INSERT INTO "session_checkout" ("organizationId", "sessionId", "installationId", "githubRepoId",
                                         "repositoryFullName", "directoryName", "baseBranch", "branch")
         VALUES ($1, $2, $3, 1, 'acme/web', 'web', 'main', 'tidy')`,
        [ids.organization, ids.session, ids.installation],
      );
    });

    it('restores the original indexes, and re-applies over the same rows', async () => {
      const before = await rowCounts();
      expect(before).toEqual({ triggers: 1, runs: 2, events: 2, checkouts: 1 });

      await revertThroughHotPath();
      await expectIndexesBeforeHotPath();
      expect(await rowCounts()).toEqual(before);

      await dataSource.runMigrations();
      await expectHotPathIndexes();
      expect(await rowCounts()).toEqual(before);
    });

    // The large-table path runs the ops scripts with psql inside the container,
    // so it needs the suite's own container.
    it.skipIf(!!process.env.SCHEMA_TEST_DATABASE_URL)(
      'on a large table, refuses at boot until the ops script has run, then creates nothing',
      async () => {
        const container = pgContainer as StartedTestContainer;
        const psql = async (file: string) => {
          const target = `/tmp/${file}`;
          await container.copyFilesToContainer([
            { source: resolve(__dirname, '../db/ops', file), target },
          ]);
          const result = await container.exec([
            'psql',
            '-v',
            'ON_ERROR_STOP=1',
            '-U',
            'test',
            '-d',
            'test',
            '-f',
            target,
          ]);
          expect(result.exitCode, result.output).toBe(0);
        };
        const oids = () =>
          byName<{ name: string; oid: number }>(
            `SELECT c.relname AS name, c.oid::int AS oid FROM pg_class c
              WHERE c.relkind = 'i' AND c.relnamespace = 'public'::regnamespace`,
          );

        await revertThroughHotPath();
        // Over the migration's 100k-row threshold once analyzed.
        await dataSource.query(
          `INSERT INTO "work_session_event" ("sessionId", "seq", "idempotencyKey", "source", "kind", "occurredAt")
           SELECT $1, 100 + g, 'bulk-' || g, 'runner', 'agent.state', now()
             FROM generate_series(1, 120000) g`,
          [ids.session],
        );
        await dataSource.query(`ANALYZE "work_session_event"`);

        await expect(dataSource.runMigrations()).rejects.toThrow(
          /IDX_work_session_event_first_prompt is missing .*1790810000000-hot-path-indexes\.sql/,
        );
        await expectIndexesBeforeHotPath();

        await psql('1790810000000-hot-path-indexes.sql');
        await expectHotPathIndexes();
        const built = await oids();
        await dataSource.runMigrations();
        await expectHotPathIndexes();
        expect(await oids()).toEqual(built);

        await psql('1790810000000-hot-path-indexes.rollback.sql');
        await expectIndexesBeforeHotPath();
        const restored = await oids();
        await revertThroughHotPath();
        expect(await oids()).toEqual(restored);

        // Small again: the migration does it all itself.
        await dataSource.query(
          `DELETE FROM "work_session_event" WHERE "sessionId" = $1 AND "idempotencyKey" LIKE 'bulk-%'`,
          [ids.session],
        );
        await dataSource.query(`VACUUM ANALYZE "work_session_event"`);
        await dataSource.runMigrations();
        await expectHotPathIndexes();
      },
      120000,
    );
  });

  /** What `AddHotPathIndexesAndDropRedundant` creates, and what it drops. */
  const HOT_PATH_CREATED = [
    'IDX_automation_run_dispatched',
    'IDX_automation_run_created_brin',
    'IDX_automation_trigger_automation',
    'IDX_work_session_event_first_prompt',
    'IDX_work_session_created_by',
    'IDX_session_checkout_installation',
  ];
  const HOT_PATH_DROPPED = ['IDX_session_checkout_session', 'IDX_work_session_organization_state'];

  const indexDefinitions = () =>
    byName<{ name: string; definition: string }>(
      `SELECT c.relname AS name, pg_get_indexdef(i.indexrelid) AS definition
         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relnamespace = 'public'::regnamespace`,
    );

  const expectHotPathIndexes = async () => {
    const index = await indexes();
    for (const name of HOT_PATH_CREATED) {
      expect(index.get(name), name).toMatchObject({ valid: true });
    }
    for (const name of HOT_PATH_DROPPED) {
      expect(index.has(name), name).toBe(false);
    }
    const definition = await indexDefinitions();
    expect(definition.get('IDX_automation_trigger_automation')?.definition).toMatch(
      /USING btree \("automationId", "organizationId", "position"\)$/,
    );
    expect(definition.get('IDX_automation_run_dispatched')?.definition).toMatch(
      /USING btree \("dispatchedAt"\) WHERE \(\(outcome\)::text = 'dispatched'::text\)$/,
    );
    expect(definition.get('IDX_work_session_event_first_prompt')?.definition).toMatch(
      /USING btree \("sessionId"\) WHERE \(\(kind\)::text = 'prompt.first'::text\)$/,
    );
    expect(definition.get('IDX_automation_run_created_brin')?.definition).toMatch(
      /USING brin \("createdAt"\)$/,
    );
  };

  const expectIndexesBeforeHotPath = async () => {
    const index = await indexes();
    for (const name of HOT_PATH_CREATED.filter((n) => n !== 'IDX_automation_trigger_automation')) {
      expect(index.has(name), name).toBe(false);
    }
    const definition = await indexDefinitions();
    expect(definition.get('IDX_automation_trigger_automation')?.definition).toMatch(
      /USING btree \("organizationId", "automationId", "position"\)$/,
    );
    expect(definition.get('IDX_session_checkout_session')?.definition).toMatch(
      /USING btree \("sessionId"\)$/,
    );
    expect(definition.get('IDX_work_session_organization_state')?.definition).toMatch(
      /USING btree \("organizationId", state, "createdAt" DESC\)$/,
    );
  };
});

/**
 * Foreign keys with no index whose leading columns are exactly theirs, and why.
 * "backs every foreign key with an index" fails on any key missing from here,
 * and on any entry here that no longer needs to be.
 */
const FOREIGN_KEYS_WITHOUT_THEIR_INDEX = new Map<string, string>([
  // Served by an index that leads with the key's uuid column, which is unique
  // across workspaces, so `organizationId` would add nothing to the lookup
  // (written down in 1790810000000-AddHotPathIndexesAndDropRedundant).
  [
    'FK_session_checkout_session',
    '("organizationId", "sessionId") → UQ_session_checkout_session_id ("sessionId", "id")',
  ],
  [
    'FK_work_session_project',
    '("organizationId", "projectId") → IDX_work_session_project_state ("projectId", "state")',
  ],
  [
    'FK_project_repository_project',
    '("organizationId", "projectId") → UQ_project_repository_project_repo ("projectId", "githubRepoId")',
  ],
  // The key's first column is `work_session`'s own primary key.
  ['FK_work_session_cwd_checkout', '("id", "cwdCheckoutId") → PK_work_session ("id")'],
  // No index at all: a parent delete scans the child table. Out of scope for
  // 1790810000000; each needs its own migration.
  [
    'FK_github_installation_installed_by',
    'TODO(follow-up): "installedByUserId", RESTRICT from user',
  ],
  ['FK_host_pairing_token_host', 'TODO(follow-up): "redeemedHostId", SET NULL from host'],
  [
    'FK_user_role_organization',
    'TODO(follow-up): "organizationId", CASCADE from organization; IDX_user_role_user_org leads with "userId"',
  ],
  [
    'FK_user_role_role',
    'TODO(follow-up): "roleId", CASCADE from role; UQ_user_role_* lead with "userId"',
  ],
]);
