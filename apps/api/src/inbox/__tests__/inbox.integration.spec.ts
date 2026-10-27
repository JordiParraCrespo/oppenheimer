import { randomUUID } from 'node:crypto';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { InboxMarkOrmEntity } from '../database/inbox-mark.orm-entity';
import { InboxMarkRepository } from '../database/inbox-mark.repository';
import { InboxMarkEntity, type InboxMarkProps } from '../domain/inbox-mark.entity';
import { InboxMarkMapper } from '../inbox-mark.mapper';

/**
 * A person's Inbox marks against a real Postgres (`29-inbox.md` §3): one row
 * per person, workspace and occurrence however many puts race, a put that
 * replaces the mark in place, the read that leaves out an ended snooze and
 * everyone else's marks, the table's own rules, an idempotent delete, the
 * event each write stages, and the cascade from the person and the
 * workspace. The schema is the migrations'.
 */
describe('inbox marks (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let marks: InboxMarkRepository;
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    process.env.DB_HOST = pg.getHost();
    process.env.DB_PORT = pg.getMappedPort(5432).toString();
    await runAllMigrations();
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [InboxMarkOrmEntity, OutboxMessageSchema],
      synchronize: false,
    });
    await dataSource.initialize();
    marks = new InboxMarkRepository(
      dataSource.getRepository(InboxMarkOrmEntity),
      new InboxMarkMapper(),
      new OutboxService(dataSource),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
  });

  beforeEach(async () => {
    organizationId = await insertOrganization();
    userId = await insertUser();
  });

  async function insertOrganization(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [id, `acme-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function insertUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  const NOW = new Date();
  const inAnHour = () => new Date(Date.now() + 60 * 60_000);

  function mark(overrides: Partial<InboxMarkProps> = {}) {
    return InboxMarkEntity.place(
      { organizationId, userId, itemKey: 'approval:ap-1', mark: 'done', until: null, ...overrides },
      NOW,
    );
  }

  async function staged(itemKey: string): Promise<number> {
    const [{ count }]: { count: string }[] = await dataSource.query(
      `SELECT count(*) FROM outbox_message
       WHERE "eventName" = 'InboxMarkChangedDomainEvent' AND payload->>'userId' = $1
         AND payload->>'itemKey' = $2`,
      [userId, itemKey],
    );
    return Number(count);
  }

  it('keeps one mark per occurrence: a second put replaces it in place, with its own event', async () => {
    await marks.upsert(mark({ mark: 'low' }));
    const firstId = (await marks.findOne(organizationId, userId, 'approval:ap-1')).unwrap().id;
    const until = inAnHour();
    await marks.upsert(mark({ mark: 'snoozed', until }));

    const stored = (await marks.findOne(organizationId, userId, 'approval:ap-1')).unwrap();
    expect(stored).toMatchObject({ id: firstId, mark: 'snoozed', until });
    expect(await staged('approval:ap-1')).toBe(2);
  });

  it('lands one row of many racing puts on one occurrence', async () => {
    await Promise.all(
      (['done', 'low', 'deleted', 'done', 'low'] as const).map((value) =>
        marks.upsert(mark({ itemKey: 'run:race', mark: value })),
      ),
    );
    const [{ count }]: { count: string }[] = await dataSource.query(
      `SELECT count(*) FROM inbox_mark WHERE "userId" = $1 AND "itemKey" = 'run:race'`,
      [userId],
    );
    expect(count).toBe('1');
  });

  it("reads the caller's marks that still hold, and nobody else's", async () => {
    await marks.upsert(mark({ itemKey: 'run:done', mark: 'done' }));
    await marks.upsert(mark({ itemKey: 'run:later', mark: 'snoozed', until: inAnHour() }));
    // A snooze that has ended, as a stored one does once its time passes.
    await marks.upsert(
      InboxMarkEntity.create({
        id: randomUUID(),
        props: {
          organizationId,
          userId,
          itemKey: 'run:ended',
          mark: 'snoozed',
          until: new Date(Date.now() - 60_000),
        },
      }),
    );
    const someoneElse = await insertUser();
    await marks.upsert(mark({ userId: someoneElse, itemKey: 'run:theirs' }));
    await marks.upsert(mark({ organizationId: await insertOrganization(), itemKey: 'run:there' }));

    const read = await marks.findInForce(organizationId, userId, new Date(), 100);
    expect(read.map((m) => m.itemKey).sort()).toEqual(['run:done', 'run:later']);
    expect(await marks.findInForce(organizationId, userId, new Date(), 1)).toHaveLength(1);
  });

  it('refuses what the table does not hold: an end without a snooze, a snooze without one, an unknown mark', async () => {
    const insert = (value: string, until: Date | null) =>
      dataSource.query(
        `INSERT INTO inbox_mark ("organizationId", "userId", "itemKey", mark, "until")
         VALUES ($1, $2, $3, $4, $5)`,
        [organizationId, userId, `run:${randomUUID()}`, value, until],
      );
    await expect(insert('snoozed', null)).rejects.toMatchObject({
      constraint: 'CHK_inbox_mark_until',
    });
    await expect(insert('done', new Date())).rejects.toMatchObject({
      constraint: 'CHK_inbox_mark_until',
    });
    await expect(insert('archived', null)).rejects.toMatchObject({
      constraint: 'CHK_inbox_mark_mark',
    });
  });

  it('deletes a mark with its event, and a second delete finds nothing and stages nothing', async () => {
    await marks.upsert(mark({ itemKey: 'run:gone' }));
    const found = (await marks.findOne(organizationId, userId, 'run:gone')).unwrap();
    found.remove();
    expect(await marks.delete(found)).toBe(true);
    expect((await marks.findOne(organizationId, userId, 'run:gone')).isNone()).toBe(true);
    expect(await staged('run:gone')).toBe(2);

    found.remove();
    expect(await marks.delete(found)).toBe(false);
    expect(await staged('run:gone')).toBe(2);
  });

  it('goes with the person and with the workspace', async () => {
    await marks.upsert(mark({ itemKey: 'run:person' }));
    await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
    expect((await marks.findOne(organizationId, userId, 'run:person')).isNone()).toBe(true);

    userId = await insertUser();
    await marks.upsert(mark({ itemKey: 'run:workspace' }));
    await dataSource.query(`DELETE FROM "organization" WHERE id = $1`, [organizationId]);
    expect((await marks.findOne(organizationId, userId, 'run:workspace')).isNone()).toBe(true);
  });
});
