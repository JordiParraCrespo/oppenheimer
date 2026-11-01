import { randomUUID } from 'node:crypto';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource, type EntityManager } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { SessionCheckoutOrmEntity } from '../database/session-checkout.orm-entity';
import { SessionTerminalWatchOrmEntity } from '../database/session-terminal-watch.orm-entity';
import { SessionTerminalWatchRepository } from '../database/session-terminal-watch.repository';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { SessionTerminalWatchEntity } from '../domain/session-terminal-watch.entity';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { SessionTerminalWatchMapper } from '../session-terminal-watch.mapper';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * The terminal watch repository's own SQL, against the migrations: the cap
 * per session counted under the session's lock so two racing watches cannot
 * both take the last place, a watch for a session that is not there (or is
 * another workspace's) refused, reads by session, deletes scoped to the
 * workspace, and every watch gone with its session.
 */
describe('sessions: terminal watches (integration)', () => {
  let dataSource: DataSource;
  let watches: SessionTerminalWatchRepository;
  let sessions: WorkSessionRepository;
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

  async function liveSession(): Promise<WorkSessionEntity> {
    const work = WorkSessionEntity.request({
      organizationId,
      projectId,
      createdByUserId: userId,
      hostId,
      slug: `bold-otter-${randomUUID().slice(0, 6)}`,
      agent: 'claude-code',
      idempotencyKey: null,
    });
    await sessions.createIfUnclaimed(work, [
      {
        idempotencyKey: `session.requested:${randomUUID()}`,
        source: 'api',
        kind: SESSION_EVENT_KINDS.REQUESTED,
        payload: { agent: 'claude-code' },
      },
    ]);
    return work;
  }

  const watch = (sessionId: string, pattern = 'FAIL', organization = organizationId) =>
    SessionTerminalWatchEntity.watch({ organizationId: organization, sessionId, pattern });

  beforeAll(async () => {
    const db = await useTestDatabase();

    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        WorkSessionOrmEntity,
        SessionCheckoutOrmEntity,
        WorkSessionEventOrmEntity,
        SessionTerminalWatchOrmEntity,
      ],
      synchronize: false,
    });
    await dataSource.initialize();

    sessions = new WorkSessionRepository(
      dataSource.getRepository(WorkSessionOrmEntity),
      dataSource,
      new WorkSessionMapper(),
      outbox(),
    );
    watches = new SessionTerminalWatchRepository(
      dataSource.getRepository(SessionTerminalWatchOrmEntity),
      new SessionTerminalWatchMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
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
       VALUES ($1, $2, 'Jordi', 'Jordi', 'Parra', true)`,
      [userId, `${userId}@example.com`],
    );
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, 'devbox', 'key', $3)`,
      [hostId, userId, randomUUID()],
    );
    await dataSource.query(
      `INSERT INTO "project" ("id", "organizationId", "name", "slug")
       VALUES ($1, $2, 'acme-web', 'acme-web')`,
      [projectId, organizationId],
    );
  });

  it('keeps a session at its cap, even when two watches race for the last place', async () => {
    const work = await liveSession();
    expect(await watches.insert(watch(work.id, 'one'), 2)).toBe('inserted');
    const outcomes = await Promise.all([
      watches.insert(watch(work.id, 'two'), 2),
      watches.insert(watch(work.id, 'three'), 2),
    ]);
    expect(outcomes.sort()).toEqual(['full', 'inserted']);
    const held = await watches.findForSessions(organizationId, [work.id]);
    expect(held.map((row) => row.pattern)[0]).toBe('one');
    expect(held).toHaveLength(2);
  });

  it("refuses a watch for a session that is not there, or is another workspace's", async () => {
    const work = await liveSession();
    expect(await watches.insert(watch(randomUUID()), 10)).toBe('missing');
    expect(await watches.insert(watch(work.id, 'x', randomUUID()), 10)).toBe('missing');
  });

  it('reads and deletes by the workspace, and goes with its session', async () => {
    const work = await liveSession();
    const made = watch(work.id);
    await watches.insert(made, 10);
    expect(await watches.findOne(randomUUID(), work.id, made.id)).toBeNull();
    expect((await watches.findOne(organizationId, work.id, made.id))?.pattern).toBe('FAIL');
    expect(await watches.delete(randomUUID(), work.id, made.id)).toBe(false);
    expect(await watches.delete(organizationId, work.id, made.id)).toBe(true);

    await watches.insert(watch(work.id), 10);
    // A session's erasure clears its log first: the log does not cascade.
    await dataSource.query(`DELETE FROM work_session_event WHERE "sessionId" = $1`, [work.id]);
    await dataSource.query(`DELETE FROM work_session WHERE id = $1`, [work.id]);
    expect(await watches.findForSessions(organizationId, [work.id])).toEqual([]);
  });
  // What breaks this: a late report lowering the count, so the watch sent
  // after a runner restart counts from below what the bot was told.
  it('keeps the newest count a report gave, never lowering it, and only in its workspace', async () => {
    const work = await liveSession();
    const made = watch(work.id);
    await watches.insert(made, 10);
    await watches.recordMatches(organizationId, made.id, 5);
    await watches.recordMatches(organizationId, made.id, 3);
    await watches.recordMatches(randomUUID(), made.id, 9);
    expect((await watches.findOne(organizationId, work.id, made.id))?.matches).toBe(5);
  });
});
