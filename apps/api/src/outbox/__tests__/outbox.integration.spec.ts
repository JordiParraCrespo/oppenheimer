import { type OutboxMessageRecord, OutboxRelay, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { loadMigrations } from '../../__tests__/run-migrations';

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
 * pending index with no sort, concurrent claims stay disjoint, and the
 * retention delete touches only old processed rows.
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

  it('indexes pending rows by age, and every row by a BRIN on createdAt', async () => {
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

  describe('a delivery slower than the lease, across two relays', () => {
    const LEASE_MS = 400;
    const SLOW_MS = 1_500;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    /** Two relays on the same table: `a` claims first and is slow, `b` polls every 50 ms. */
    const twoRelays = (heartbeatMs: number) => {
      const deliveries: string[] = [];
      const relay = (owner: string, delayMs: number) =>
        new OutboxRelay(
          new OutboxService(dataSource),
          async (message: OutboxMessageRecord) => {
            deliveries.push(`${owner}:${message.id}`);
            await sleep(delayMs);
          },
          { owner, leaseMs: LEASE_MS, heartbeatMs, pollIntervalMs: 50 },
        );
      return { deliveries, a: relay('relay:a', SLOW_MS), b: relay('relay:b', 0) };
    };

    const row = async () =>
      (
        (await dataSource.query(
          `SELECT "id", "status", "lockedBy", "attempts" FROM "outbox_message"`,
        )) as { id: string; status: string; lockedBy: string | null; attempts: number }[]
      )[0];

    beforeEach(async () => {
      await dataSource.query(`TRUNCATE "outbox_message"`);
      await seed(1, 'pending');
    });

    it('runs the listener once: the heartbeat keeps the lease past leaseMs', async () => {
      const { deliveries, a, b } = twoRelays(LEASE_MS / 4);
      const draining = a.requestDrain();
      await sleep(50);
      b.start();
      await expect(draining).resolves.toBe(1);
      await sleep(200);
      await b.stop();

      const { id, status, attempts } = await row();
      expect(deliveries).toEqual([`relay:a:${id}`]);
      expect(status).toBe('processed');
      expect(attempts).toBe(1);
    });

    it('when the lease is lost anyway, the stale relay leaves the new claim alone', async () => {
      // Renewals slower than the lease: the row lapses mid-delivery and `b`
      // claims it. That duplicate is the one a stall past leaseMs still costs;
      // what the fence guarantees is that `a` finishing late does not mark
      // `b`'s claim processed or release it.
      const { deliveries, a, b } = twoRelays(SLOW_MS * 10);
      const draining = a.requestDrain();
      await sleep(50);
      const slowB = new OutboxRelay(
        new OutboxService(dataSource),
        async (message) => {
          deliveries.push(`relay:b:${message.id}`);
          await sleep(SLOW_MS * 2);
        },
        { owner: 'relay:b', leaseMs: 60_000, pollIntervalMs: 50 },
      );
      slowB.start();
      await draining;

      // `a` is done; `b` is still delivering its claim.
      const { id, status, lockedBy, attempts } = await row();
      expect(deliveries).toEqual([`relay:a:${id}`, `relay:b:${id}`]);
      expect(status).toBe('pending');
      expect(lockedBy).toBe('relay:b');
      expect(attempts).toBe(2);

      // A stale failure from `a`'s claim is fenced off too.
      await new OutboxService(dataSource).markFailed(
        { id, attempts: 1, lockedBy: 'relay:a' } as OutboxMessageRecord,
        'stale',
      );
      expect(await row()).toMatchObject({ status: 'pending', lockedBy: 'relay:b' });

      await slowB.stop();
      await b.stop();
      expect((await row()).status).toBe('processed');
    }, 20_000);
  });
});
