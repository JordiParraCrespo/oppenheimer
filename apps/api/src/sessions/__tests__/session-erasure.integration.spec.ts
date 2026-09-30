import { randomUUID } from 'node:crypto';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, type EntityManager, type QueryRunner } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { SessionCheckoutOrmEntity } from '../database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * Erasing a workspace's sessions while a writer is mid-transaction. The erase
 * deletes the log before the sessions, and the log's key refuses a session that
 * still has events, so a writer that commits between the two deletes would make
 * deleting an account fail. Each case holds a writer's lock in a transaction of
 * its own, waits until Postgres reports the erase blocked behind it, and only
 * then writes and commits.
 */
describe('sessions: erasing a workspace (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let repository: WorkSessionRepository;
  let organizationId: string;
  let projectId: string;
  let hostId: string;
  let userId: string;

  const outbox = () =>
    ({
      transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
        dataSource.transaction(work),
      stageEvents: async () => undefined,
    }) as unknown as OutboxService;

  const session = () =>
    WorkSessionEntity.request({
      organizationId,
      projectId,
      createdByUserId: userId,
      hostId,
      slug: `bold-otter-${randomUUID().slice(0, 6)}`,
      agent: 'claude-code',
      idempotencyKey: null,
    });

  const requested = () => [
    {
      idempotencyKey: `session.requested:${randomUUID()}`,
      source: 'api' as const,
      kind: SESSION_EVENT_KINDS.REQUESTED,
      payload: { agent: 'claude-code' },
    },
  ];

  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = pgContainer.getHost();
    process.env.DB_PORT = pgContainer.getMappedPort(5432).toString();
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
      entities: [WorkSessionOrmEntity, SessionCheckoutOrmEntity, WorkSessionEventOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();

    repository = new WorkSessionRepository(
      dataSource.getRepository(WorkSessionOrmEntity),
      dataSource,
      new WorkSessionMapper(),
      outbox(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    userId = randomUUID();
    hostId = randomUUID();
    projectId = randomUUID();

    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    await dataSource.query(
      `INSERT INTO "user" ("id", "email", "name", "firstName", "lastName", "emailVerified")
       VALUES ($1, $2, 'Jordi', 'Jordi', 'Parra', false)`,
      [userId, `${userId}@example.com`],
    );
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, 'devbox', 'key', $3)`,
      [hostId, userId, randomUUID()],
    );
    await dataSource.query(
      `INSERT INTO "project" ("id", "organizationId", "name", "slug")
       VALUES ($1, $2, 'xrp-mobile', 'xrp-mobile')`,
      [projectId, organizationId],
    );
  });

  /** A transaction on its own connection, and the backend pid Postgres gave it. */
  async function writer(): Promise<{ runner: QueryRunner; pid: number }> {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const [{ pid }] = await runner.query(`SELECT pg_backend_pid() AS "pid"`);
    return { runner, pid };
  }

  /** Resolves once some other backend is waiting on a lock `pid` holds. */
  async function blockedBehind(pid: number): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const [{ waiting }] = await dataSource.query(
        `SELECT count(*)::int AS "waiting" FROM pg_stat_activity
          WHERE $1 = ANY (pg_blocking_pids("pid"))`,
        [pid],
      );
      if (waiting > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`nothing waited on backend ${pid}: the erase did not take the writer's lock`);
  }

  const insertEvent = (runner: QueryRunner, sessionId: string) =>
    runner.query(
      `INSERT INTO "work_session_event"
         ("sessionId", "seq", "idempotencyKey", "source", "kind", "payload", "occurredAt")
       SELECT $1, COALESCE(max("seq"), 0) + 1, $2, 'runner', $3, '{}'::jsonb, now()
         FROM "work_session_event" WHERE "sessionId" = $1`,
      [sessionId, `late:${randomUUID()}`, SESSION_EVENT_KINDS.AGENT_OBSERVED],
    );

  async function nothingLeft(): Promise<void> {
    const [{ sessions }] = await dataSource.query(
      `SELECT count(*)::int AS "sessions" FROM "work_session" WHERE "organizationId" = $1`,
      [organizationId],
    );
    const [{ logged }] = await dataSource.query(
      `SELECT count(*)::int AS "logged" FROM "work_session_event" e
         JOIN "work_session" s ON s."id" = e."sessionId"
        WHERE s."organizationId" = $1`,
      [organizationId],
    );
    expect({ sessions, logged }).toEqual({ sessions: 0, logged: 0 });
  }

  it('waits for an append holding a session row, then erases what it wrote', async () => {
    const work = session();
    await repository.createIfUnclaimed(work, requested());

    // The append's own statements: the row lock, then the insert. The
    // repository runs them in one transaction with nothing to pause between.
    const { runner, pid } = await writer();
    try {
      await runner.query(`SELECT "id" FROM "work_session" WHERE "id" = $1 FOR UPDATE`, [work.id]);
      const erasing = repository.eraseWorkspace(organizationId);
      await blockedBehind(pid);
      await insertEvent(runner, work.id);
      await runner.commitTransaction();
      await expect(erasing).resolves.toBeUndefined();
    } finally {
      await runner.release();
    }

    await nothingLeft();
    const late = await repository.appendEventsForHost(hostId, work.id, [
      {
        idempotencyKey: `late:${randomUUID()}`,
        source: 'runner',
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'working' },
      },
    ]);
    expect(late.isNone()).toBe(true);
  });

  it('waits for a create holding its project, then erases the session it made', async () => {
    // A create's own statements: the project `FOR SHARE`, then the session and
    // its first entry.
    const { runner, pid } = await writer();
    const work = session();
    try {
      await runner.query(`SELECT "id" FROM "project" WHERE "id" = $1 FOR SHARE`, [projectId]);
      const erasing = repository.eraseWorkspace(organizationId);
      await blockedBehind(pid);
      await runner.manager.insert(
        WorkSessionOrmEntity,
        new WorkSessionMapper().toPersistence(work),
      );
      await insertEvent(runner, work.id);
      await runner.commitTransaction();
      await expect(erasing).resolves.toBeUndefined();
    } finally {
      await runner.release();
    }

    await nothingLeft();
  });
});
