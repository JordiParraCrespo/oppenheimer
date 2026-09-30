import { randomUUID } from 'node:crypto';
import { likeContains } from '@oppenheimer/backend-core';
import { USERNAME_PATTERN } from '@oppenheimer/shared';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { loadMigrations } from './run-migrations';

/**
 * Rules the schema holds as a whole, checked on what the migrations build rather than
 * on the entities: a migration's raw SQL and the outbox's `EntitySchema` land in the
 * same catalogue, and only here are all of them seen at once. The last case reverts
 * and reapplies the migrations, so every `down()` is proven too.
 *
 * The suite starts its own Postgres 16 container. Without Docker,
 * `SCHEMA_TEST_DATABASE_URL` (`postgres://user:pass@host:port/db`) points it at an
 * empty, disposable database, which it migrates, writes rows to and reverts.
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

  // The value object and the database refuse the same usernames.
  it('checks a username against USERNAME_PATTERN', async () => {
    const [check]: { definition: string }[] = await dataSource.query(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conname = 'CHK_user_username'`,
    );
    expect(check.definition).toContain(`'${USERNAME_PATTERN.source}'`);
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

  describe('the user search and the foreign keys it once left bare', () => {
    /** Each index, with what `pg_get_indexdef` ends with. */
    const EXPECTED: [string, RegExp][] = [
      [
        'IDX_user_search_trgm',
        /USING gin \("firstName" gin_trgm_ops, "lastName" gin_trgm_ops, email gin_trgm_ops\)$/,
      ],
      ['IDX_github_installation_installed_by', /USING btree \("installedByUserId"\)$/],
      [
        'IDX_host_pairing_token_redeemed_host',
        /USING btree \("redeemedHostId"\) WHERE \("redeemedHostId" IS NOT NULL\)$/,
      ],
      [
        'IDX_user_role_organization',
        /USING btree \("organizationId"\) WHERE \("organizationId" IS NOT NULL\)$/,
      ],
      ['IDX_user_role_role', /USING btree \("roleId"\)$/],
    ];
    const expectIndexes = async () => {
      const index = await indexes();
      const definition = await indexDefinitions();
      for (const [name, pattern] of EXPECTED) {
        expect(index.get(name), name).toMatchObject({ valid: true });
        expect(definition.get(name)?.definition, name).toMatch(pattern);
      }
    };

    /** The admin search as `UserRepository.findUsers` issues it. */
    const search = (term: string) =>
      dataSource.query(
        `SELECT "email" FROM "user"
          WHERE "firstName" ILIKE $1 OR "lastName" ILIKE $1 OR "email" ILIKE $1
          ORDER BY "email"`,
        [likeContains(term)],
      );

    beforeAll(async () => {
      await dataSource.query(
        `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
         VALUES ($1, 'Axb', 'axb@search.test', 'Axb', 'Plain'),
                ($2, 'A_b', 'a_b@search.test', 'A_b', 'Underscore'),
                ($3, 'Pct', 'pct@search.test', 'Fifty%', 'Percent')`,
        [randomUUID(), randomUUID(), randomUUID()],
      );
    });

    it('builds the user search index and backs the four foreign keys', async () => {
      await expectIndexes();
    });

    it('matches `_` and `%` literally, and serves the search from the trigram index', async () => {
      expect(await search('a_b')).toEqual([{ email: 'a_b@search.test' }]);
      expect(await search('%')).toEqual([{ email: 'pct@search.test' }]);
      expect(await search('axb')).toEqual([{ email: 'axb@search.test' }]);

      // The planner prefers a sequential scan on a table this small; with it
      // off, the plan shows the one index serving all three conditions.
      const plan: { 'QUERY PLAN': string }[] = await dataSource.transaction(async (manager) => {
        await manager.query('SET LOCAL enable_seqscan = off');
        return manager.query(
          `EXPLAIN SELECT "email" FROM "user"
            WHERE "firstName" ILIKE $1 OR "lastName" ILIKE $1 OR "email" ILIKE $1`,
          [likeContains('ada')],
        );
      });
      const text = plan.map((row) => row['QUERY PLAN']).join('\n');
      expect(text).toContain('BitmapOr');
      expect(text.match(/Bitmap Index Scan on "IDX_user_search_trgm"/g)).toHaveLength(3);
    });
  });

  // Last, because it takes every table away and puts it back empty.
  it('reverts every migration to an empty schema, and applies them again', async () => {
    const tables = () =>
      dataSource.query(
        `SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> 'migrations' ORDER BY 1`,
      );
    const before = await tables();
    while ((await dataSource.query(`SELECT 1 FROM "migrations"`)).length > 0) {
      await dataSource.undoLastMigration();
    }
    expect(await tables()).toEqual([]);

    await dataSource.runMigrations();
    expect(await tables()).toEqual(before);
    await expectHardenedAuthTables();
    await expectHotPathIndexes();
  });

  const HOT_PATH_CREATED = [
    'IDX_automation_run_dispatched',
    'IDX_automation_run_created_brin',
    'IDX_automation_trigger_automation',
    'IDX_work_session_event_first_prompt',
    'IDX_work_session_created_by',
    'IDX_session_checkout_installation',
  ];

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
});

/**
 * Foreign keys with no index whose leading columns are exactly theirs, and why.
 * "backs every foreign key with an index" fails on any key missing from here,
 * and on any entry here that no longer needs to be.
 */
const FOREIGN_KEYS_WITHOUT_THEIR_INDEX = new Map<string, string>([
  // Served by an index that leads with the key's uuid column, which is unique
  // across workspaces, so `organizationId` would add nothing to the lookup.
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
]);
