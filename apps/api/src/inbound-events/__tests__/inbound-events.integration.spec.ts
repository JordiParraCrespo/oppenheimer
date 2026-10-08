import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { InboundDeliveryOrmEntity } from '../database/inbound-delivery.orm-entity';
import { InboundEventOrmEntity } from '../database/inbound-event.orm-entity';
import { InboundEventRepository } from '../database/inbound-event.repository';
import type { NewDelivery } from '../database/inbound-event.repository.port';
import type { ExternalEvent, InboundDelivery } from '../domain/external-event.types';
import { InboundEventMapper } from '../inbound-event.mapper';

/**
 * The inbound-events store against a real Postgres, through the repository the
 * hub uses: the replay defence on `receive` (the same signed bytes under a new
 * delivery id are the delivery already stored) and the delivery's `eventCount`
 * across a re-run.
 */
describe('inbound events store (integration)', () => {
  let container: StartedTestContainer;
  let dataSource: DataSource;
  let store: InboundEventRepository;

  const ORG = '44444444-4444-4444-8444-444444444444';

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
      entities: [InboundDeliveryOrmEntity, InboundEventOrmEntity, OutboxMessageSchema],
    });
    await dataSource.initialize();
    store = new InboundEventRepository(
      dataSource,
      dataSource.getRepository(InboundEventOrmEntity),
      new OutboxService(dataSource),
      new InboundEventMapper(),
    );
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'acme', 'acme')`,
      [ORG],
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  function delivery(deliveryId: string, payloadDigest: string, action = 'opened'): NewDelivery {
    return {
      source: 'github',
      deliveryId,
      eventName: 'issues',
      payload: { action },
      payloadDigest,
      correlationId: `corr-${deliveryId}`,
    };
  }

  async function rowsFor(column: 'deliveryId' | 'payloadDigest', value: string) {
    return dataSource.query(`SELECT "id" FROM "inbound_delivery" WHERE "${column}" = $1`, [value]);
  }

  describe('receive', () => {
    it('stores the same signed bytes once, whatever delivery id they claim', async () => {
      const digest = 'a'.repeat(64);

      await expect(store.receive(delivery('replay-1', digest))).resolves.toBe(true);
      // Regression: the replay under a fresh id used to be a second delivery,
      // with its own events and its own automation runs.
      await expect(store.receive(delivery('replay-2', digest))).resolves.toBe(false);

      expect(await rowsFor('payloadDigest', digest)).toHaveLength(1);
      expect(await rowsFor('deliveryId', 'replay-2')).toHaveLength(0);
      const jobs: unknown[] = await dataSource.query(
        `SELECT 1 FROM "outbox_message" WHERE "reason" LIKE '%replay-2%'`,
      );
      expect(jobs).toHaveLength(0);
    });

    it("treats a provider's retry of the same id as before", async () => {
      const digest = 'b'.repeat(64);
      await expect(store.receive(delivery('retry-1', digest))).resolves.toBe(true);
      await expect(store.receive(delivery('retry-1', digest))).resolves.toBe(false);
      expect(await rowsFor('deliveryId', 'retry-1')).toHaveLength(1);
    });

    it('still dedupes different bytes on the delivery id', async () => {
      await expect(store.receive(delivery('same-id', 'c'.repeat(64)))).resolves.toBe(true);
      await expect(store.receive(delivery('same-id', 'd'.repeat(64), 'closed'))).resolves.toBe(
        false,
      );
      expect(await rowsFor('deliveryId', 'same-id')).toHaveLength(1);
    });

    it('leaves rows from before the digest alone', async () => {
      // Two legacy rows with no digest do not collide on the partial unique.
      for (const id of ['legacy-1', 'legacy-2']) {
        await dataSource.query(
          `INSERT INTO "inbound_delivery" ("source", "deliveryId", "eventName", "payload")
           VALUES ('github', $1, 'issues', '{}')`,
          [id],
        );
      }
      const rows = await dataSource.query(
        `SELECT 1 FROM "inbound_delivery" WHERE "deliveryId" LIKE 'legacy-%'`,
      );
      expect(rows).toHaveLength(2);
    });
  });

  describe('recordProcessed', () => {
    function event(externalId: string): ExternalEvent {
      return {
        source: 'github',
        type: 'issue_opened',
        externalId,
        subject: { kind: 'repository', ref: '1', name: 'acme/atlas' },
        actor: { login: 'someone', isOwnApp: false },
        attributes: {},
        context: {},
        occurredAt: new Date(),
        schemaVersion: 1,
      };
    }

    it("counts the delivery's events, not the last run's", async () => {
      await store.receive(delivery('count-1', 'e'.repeat(64)));
      const [{ id }] = await rowsFor('deliveryId', 'count-1');
      const stored: InboundDelivery = {
        id,
        source: 'github',
        deliveryId: 'count-1',
        eventName: 'issues',
        payload: {},
        receivedAt: new Date(),
      };
      const events = [event('count-1:a'), event('count-1:b')];

      await expect(store.recordProcessed(stored, [ORG], events)).resolves.toBe(2);
      // The re-run a queue that runs a job twice, or the sweep, owes: nothing
      // newly stored, and the count — regression: it was reset to 0 — stays 2.
      await expect(store.recordProcessed(stored, [ORG], events)).resolves.toBe(0);

      const [row] = await dataSource.query(
        `SELECT "eventCount", "status" FROM "inbound_delivery" WHERE "id" = $1`,
        [id],
      );
      expect(row).toEqual({ eventCount: 2, status: 'processed' });
    });
  });
});
