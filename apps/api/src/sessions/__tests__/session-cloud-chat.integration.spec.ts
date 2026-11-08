import { randomUUID } from 'node:crypto';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource, type EntityManager } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { SessionCheckoutOrmEntity } from '../database/session-checkout.orm-entity';
import { SessionCloudChatRepository } from '../database/session-cloud-chat.repository';
import { SessionCloudIdleOrmEntity } from '../database/session-cloud-idle.orm-entity';
import { SessionCloudLineOrmEntity } from '../database/session-cloud-line.orm-entity';
import { SessionCloudReplyOrmEntity } from '../database/session-cloud-reply.orm-entity';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * The cloud chat repository's own SQL for waking an idle session, against
 * the migrations: a session's idle mark set and cleared by its Stop hook, and
 * claimed once when two replies race for it, and again only once a wake is
 * stale; every waiting reply claimed by a wake, oldest first, without one a
 * hook holds; and claimed replies put back. What the waker does with these answers is
 * `cloud-reply-wake.spec.ts`.
 */
describe('sessions: cloud chat idle and claims (integration)', () => {
  let dataSource: DataSource;
  let chat: SessionCloudChatRepository;
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

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        WorkSessionOrmEntity,
        SessionCheckoutOrmEntity,
        WorkSessionEventOrmEntity,
        SessionCloudLineOrmEntity,
        SessionCloudReplyOrmEntity,
        SessionCloudIdleOrmEntity,
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
    chat = new SessionCloudChatRepository(
      dataSource.getRepository(SessionCloudLineOrmEntity),
      dataSource.getRepository(SessionCloudReplyOrmEntity),
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

  it('claims an idle session once, however many replies race for it, and a stale wake again', async () => {
    const work = await liveSession();
    expect(await chat.claimIdle(organizationId, work.id, 300)).toBe(false);

    await chat.markIdle(organizationId, work.id);
    const claims = await Promise.all([
      chat.claimIdle(organizationId, work.id, 300),
      chat.claimIdle(organizationId, work.id, 300),
      chat.claimIdle(organizationId, work.id, 300),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    // A wake still in its window holds the session; one past it does not.
    expect(await chat.claimIdle(organizationId, work.id, 300)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await chat.claimIdle(organizationId, work.id, 0)).toBe(true);

    // A hook that asks ends the wake: nothing is stale after it.
    await chat.markListening(organizationId, work.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await chat.claimIdle(organizationId, work.id, 0)).toBe(false);
    expect(await chat.claimIdle(randomUUID(), work.id, 0)).toBe(false);
  });

  it('claims every waiting reply oldest first, leaves a hook the one it holds, and puts them back', async () => {
    const work = await liveSession();
    const first = await chat.addReply(organizationId, work.id, userId, 'Ship it');
    const second = await chat.addReply(organizationId, work.id, userId, 'Then tag it');

    const claimed = await chat.claimWaiting(work.id);
    expect(claimed.map((reply) => reply.text)).toEqual(['Ship it', 'Then tag it']);
    expect(await chat.claimWaiting(work.id)).toEqual([]);
    expect(await chat.collectReply(work.id)).toBeNull();

    await chat.releaseReplies(work.id, [first.id, second.id]);
    const [held, rest] = await Promise.all([
      chat.collectReply(work.id),
      chat.claimWaiting(work.id),
    ]);
    // Each reply went to exactly one of them, whichever locked it first.
    const taken = [...(held ? [held.id] : []), ...rest.map((reply) => reply.id)];
    expect(taken.sort()).toEqual([first.id, second.id].sort());
    await chat.releaseReplies(randomUUID(), [first.id]);
    expect(await chat.collectReply(work.id)).toBeNull();
  });
});
