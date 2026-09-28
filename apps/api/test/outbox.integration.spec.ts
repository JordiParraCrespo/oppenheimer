import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { loadMigrations } from './run-migrations';

const MIGRATION = 'OutboxPendingIndexAndRetention1790800000000';
const OPS_DIR = resolve(__dirname, '../db/ops');
const OPS = '1790800000000-outbox-pending-index.sql';
const ROLLBACK = '1790800000000-outbox-pending-index.rollback.sql';

/** The claim's inner SELECT, as `OutboxService.claim` runs it. */
const CLAIM_SELECT = `SELECT "id" FROM "outbox_message"
   WHERE "status" = 'pending'
     AND "availableAt" <= now()
     AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())
   ORDER BY "createdAt" ASC
   LIMIT 20
   FOR UPDATE SKIP LOCKED`;

/**
 * The outbox table against a real Postgres: the claim is served by the partial
 * pending index with no sort, concurrent claims stay disjoint, the retention
 * delete touches only old processed rows, and migration
 * `1790800000000-OutboxPendingIndexAndRetention` reverts, re-applies, and on a
 * large table defers to its ops scripts, which are run here with psql exactly
 * as the header says.
 */
describe('the outbox table (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let outbox: OutboxService;

  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgres://test:test@${pgContainer.getHost()}:${pgContainer.getMappedPort(5432)}/test`;
    dataSource = new DataSource({ type: 'postgres', url, migrations: await loadMigrations() });
    await dataSource.initialize();
    await dataSource.runMigrations();
    outbox = new OutboxService(dataSource);
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  const indexes = async () =>
    new Map<string, { definition: string; valid: boolean }>(
      (
        (await dataSource.query(
          `SELECT c.relname AS name, pg_get_indexdef(i.indexrelid) AS definition, i.indisvalid AS valid
             FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE i.indrelid = '"outbox_message"'::regclass`,
        )) as { name: string; definition: string; valid: boolean }[]
      ).map(({ name, ...rest }) => [name, rest]),
    );

  const expectNewIndexes = async () => {
    const index = await indexes();
    expect([...index.keys()].sort()).toEqual([
      'IDX_outbox_message_created_brin',
      'IDX_outbox_message_pending',
      'PK_outbox_message',
    ]);
    expect(index.get('IDX_outbox_message_pending')).toMatchObject({ valid: true });
    expect(index.get('IDX_outbox_message_pending')?.definition).toMatch(
      /\("createdAt"\) WHERE \(\(status\)::text = 'pending'::text\)/,
    );
    expect(index.get('IDX_outbox_message_created_brin')?.definition).toMatch(/USING brin/);
  };

  const expectOriginalIndexes = async () => {
    const index = await indexes();
    expect([...index.keys()].sort()).toEqual([
      'IDX_outbox_message_status_available',
      'PK_outbox_message',
    ]);
  };

  /** Undoes migrations, newest first, until this one is no longer applied. */
  const revertThroughThis = async () => {
    for (;;) {
      const [applied] = await dataSource.query(`SELECT 1 FROM "migrations" WHERE "name" = $1`, [
        MIGRATION,
      ]);
      if (!applied) return;
      await dataSource.undoLastMigration();
    }
  };

  /** Runs an ops script with psql in autocommit mode, as its header says to. */
  const psql = async (file: string) => {
    await pgContainer.copyContentToContainer([
      { content: readFileSync(resolve(OPS_DIR, file), 'utf8'), target: `/tmp/${file}` },
    ]);
    const result = await pgContainer.exec([
      'psql',
      '-U',
      'test',
      '-d',
      'test',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      `/tmp/${file}`,
    ]);
    expect(result.exitCode, result.output).toBe(0);
  };

  /**
   * Seeds `count` rows, one minute apart going back from now. `availableAt` and
   * `lockedUntil` are offsets from now in minutes (a retry in backoff, a live lease).
   */
  const seed = (
    count: number,
    status: string,
    { availableAt = 0, lockedUntil }: { availableAt?: number; lockedUntil?: number } = {},
  ) =>
    dataSource.query(
      `INSERT INTO "outbox_message"
         ("eventName", "payload", "reason", "status", "createdAt", "availableAt", "lockedUntil")
       SELECT 'SeededDomainEvent', '{}'::jsonb, 'seeded by the test', $2,
              now() - (n * interval '1 minute'),
              now() + ($3::int * interval '1 minute'),
              now() + ($4::int * interval '1 minute')
         FROM generate_series(1, $1) AS n`,
      [count, status, availableAt, lockedUntil ?? null],
    );

  it('replaces the (status, availableAt) index with the partial pending index and a BRIN', async () => {
    await expectNewIndexes();
  });

  describe('the claim', () => {
    beforeAll(async () => {
      await dataSource.query(`TRUNCATE "outbox_message"`);
      await seed(20_000, 'processed');
      await seed(40, 'pending');
      // Pending but not due yet (a retry in backoff), and pending under a live lease.
      await seed(5, 'pending', { availableAt: 60 });
      await seed(5, 'pending', { lockedUntil: 60 });
      await dataSource.query(`ANALYZE "outbox_message"`);
    });

    it('reads the partial pending index in order, with no sort', async () => {
      const [{ 'QUERY PLAN': plan }] = await dataSource.query(
        `EXPLAIN (FORMAT JSON) ${CLAIM_SELECT}`,
      );
      const text = JSON.stringify(plan);
      expect(text).toContain('IDX_outbox_message_pending');
      expect(text).not.toContain('"Node Type":"Sort"');
    });

    it('claims the oldest due, unleased pending rows', async () => {
      const due: { id: string }[] = await dataSource.query(
        `SELECT "id" FROM "outbox_message"
          WHERE "status" = 'pending' AND "availableAt" <= now() AND "lockedUntil" IS NULL
          ORDER BY "createdAt" ASC LIMIT 20`,
      );
      const claimed = await outbox.claim('test:1', { batchSize: 20 });
      expect(claimed.map((row) => row.id).sort()).toEqual(due.map((row) => row.id).sort());
      expect(claimed.every((row) => row.lockedBy === 'test:1' && row.attempts === 1)).toBe(true);
    });

    it('gives two concurrent claims disjoint rows', async () => {
      const [a, b] = await Promise.all([
        outbox.claim('test:a', { batchSize: 10 }),
        outbox.claim('test:b', { batchSize: 10 }),
      ]);
      const ids = [...a, ...b].map((row) => row.id);
      expect(a.length + b.length).toBe(20);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('deleteProcessedBefore', () => {
    beforeAll(async () => {
      await dataSource.query(`TRUNCATE "outbox_message"`);
      await dataSource.query(
        `INSERT INTO "outbox_message" ("eventName", "payload", "reason", "status", "createdAt") VALUES
           ('Old', '{}', 'r', 'processed', now() - interval '10 days'),
           ('Old', '{}', 'r', 'processed', now() - interval '9 days'),
           ('Old', '{}', 'r', 'processed', now() - interval '8 days'),
           ('Recent', '{}', 'r', 'processed', now() - interval '1 day'),
           ('OldPending', '{}', 'r', 'pending', now() - interval '10 days'),
           ('OldFailed', '{}', 'r', 'failed', now() - interval '10 days')`,
      );
    });

    it('deletes only processed rows older than the cutoff, at most a batch at a time', async () => {
      const cutoff = new Date(Date.now() - 7 * 86_400_000);
      await expect(outbox.deleteProcessedBefore(cutoff, 2)).resolves.toBe(2);
      await expect(outbox.deleteProcessedBefore(cutoff, 2)).resolves.toBe(1);
      await expect(outbox.deleteProcessedBefore(cutoff, 2)).resolves.toBe(0);

      const left: { eventName: string }[] = await dataSource.query(
        `SELECT "eventName" FROM "outbox_message" ORDER BY "eventName"`,
      );
      expect(left.map((row) => row.eventName)).toEqual(['OldFailed', 'OldPending', 'Recent']);
    });
  });

  describe('reverting and re-applying the migration', () => {
    beforeAll(async () => {
      await dataSource.query(`TRUNCATE "outbox_message"`);
    });

    it('restores the original index on a small table, and re-applies', async () => {
      await revertThroughThis();
      await expectOriginalIndexes();
      await dataSource.runMigrations();
      await expectNewIndexes();
    });

    it('on a large table defers to the ops scripts, then passes without building anything', async () => {
      await seed(110_000, 'processed');
      await dataSource.query(`ANALYZE "outbox_message"`);

      // Reverting: down() refuses to build or drop on a large table.
      await expect(revertThroughThis()).rejects.toThrow(ROLLBACK);
      await psql(ROLLBACK);
      await revertThroughThis();
      await expectOriginalIndexes();

      // Deploying: up() refuses until the ops script has built the indexes.
      await expect(dataSource.runMigrations()).rejects.toThrow(OPS);
      await psql(OPS);
      await dataSource.runMigrations();
      await expectNewIndexes();
    }, 120000);
  });
});
