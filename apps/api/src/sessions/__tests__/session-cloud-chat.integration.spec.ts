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
 * claimed once when two replies race for it; a waiting reply claimed by one
 * of a hook and a wake, never both; and a claimed reply put back. What the waker does with these answers is
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

  it('claims an idle session once, however many replies race for it', async () => {
    const work = await liveSession();
    expect(await chat.claimIdle(organizationId, work.id)).toBe(false);

    await chat.markIdle(organizationId, work.id);
    const claims = await Promise.all([
      chat.claimIdle(organizationId, work.id),
      chat.claimIdle(organizationId, work.id),
      chat.claimIdle(organizationId, work.id),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);

    await chat.markIdle(organizationId, work.id);
    await chat.markListening(organizationId, work.id);
    expect(await chat.claimIdle(organizationId, work.id)).toBe(false);
    expect(await chat.claimIdle(randomUUID(), work.id)).toBe(false);
  });

  it('gives a waiting reply to one of a hook and a wake, and takes a claimed one back', async () => {
    const work = await liveSession();
    const reply = await chat.addReply(organizationId, work.id, userId, 'Ship it');

    const [claimed, collected] = await Promise.all([
      chat.claimReply(work.id, reply.id),
      chat.collectReply(work.id),
    ]);
    expect(Number(claimed) + Number(collected !== null)).toBe(1);
    expect(await chat.claimReply(work.id, reply.id)).toBe(false);
    expect(await chat.collectReply(work.id)).toBeNull();

    await chat.releaseReply(work.id, reply.id);
    expect((await chat.collectReply(work.id))?.id).toBe(reply.id);
    expect(await chat.claimReply(randomUUID(), reply.id)).toBe(false);
  });
});
