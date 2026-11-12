import { randomUUID } from 'node:crypto';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { SessionCheckoutOrmEntity } from '../database/session-checkout.orm-entity';
import {
  SessionCloudChatRepository,
  WAKE_CLOUD_SESSION_JOB,
} from '../database/session-cloud-chat.repository';
import { SessionCloudLineOrmEntity } from '../database/session-cloud-line.orm-entity';
import { SessionCloudReplyOrmEntity } from '../database/session-cloud-reply.orm-entity';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * A cloud session's replies against the migrations: a reply is kept with its
 * wake staged in the same transaction, and the Stop hook's take and a host's
 * wake claim one reply between them, so it reaches the agent once whichever
 * comes first, and a send the host certainly did not make goes back to the
 * hook. The wake's own decisions (which host, what to hand back) are
 * `wake-cloud-session.command-handler.spec.ts`.
 */
describe('sessions: cloud chat replies (integration)', () => {
  let dataSource: DataSource;
  let chat: SessionCloudChatRepository;
  let sessions: WorkSessionRepository;
  let organizationId: string;
  let sessionId: string;
  let authorId: string;

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
        OutboxMessageSchema,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    const outbox = new OutboxService(dataSource);
    sessions = new WorkSessionRepository(
      dataSource.getRepository(WorkSessionOrmEntity),
      dataSource,
      new WorkSessionMapper(),
      outbox,
    );
    chat = new SessionCloudChatRepository(
      dataSource.getRepository(SessionCloudLineOrmEntity),
      dataSource.getRepository(SessionCloudReplyOrmEntity),
      outbox,
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    const userId = randomUUID();
    authorId = userId;
    const hostId = randomUUID();
    const projectId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    await dataSource.query(
      `INSERT INTO "user" ("id", "email", "name", "firstName", "lastName", "emailVerified")
       VALUES ($1, $2, 'Ana', 'Ana', 'Ruiz', true)`,
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
    sessionId = work.id;
  });

  const addReply = (text = 'Now tag the release') =>
    chat.addReply(organizationId, sessionId, authorId, text, new Date(Date.now() + 15_000));

  it('keeps a reply with its wake staged on the outbox for its time', async () => {
    const at = new Date(Date.now() + 15_000);
    const reply = await chat.addReply(organizationId, sessionId, authorId, 'go', at);
    expect(reply).toMatchObject({ text: 'go', collectedAt: null, deliveredVia: null });
    const staged: { topic: string; eventName: string; payload: unknown; availableAt: Date }[] =
      await dataSource.query(
        `SELECT topic, "eventName", payload, "availableAt" FROM outbox_message WHERE "aggregateId" = $1 AND topic = $2`,
        [sessionId, QUEUE_NAMES.CLOUD_REPLY_WAKES],
      );
    expect(staged).toHaveLength(1);
    expect(staged[0]).toMatchObject({
      topic: QUEUE_NAMES.CLOUD_REPLY_WAKES,
      eventName: WAKE_CLOUD_SESSION_JOB,
      payload: { sessionId, replyId: reply.id },
    });
    expect(Math.abs(new Date(staged[0].availableAt).getTime() - at.getTime())).toBeLessThan(1000);
  });

  it('gives a reply the hook took nothing for the wake to send', async () => {
    const reply = await addReply();
    expect((await chat.collectReply(sessionId))?.deliveredVia).toBe('hook');
    expect(await chat.claimReplyForHost(sessionId, reply.id)).toBeNull();
  });

  it('gives the hook nothing once the wake has claimed the reply', async () => {
    const reply = await addReply();
    expect((await chat.claimReplyForHost(sessionId, reply.id))?.deliveredVia).toBe('host');
    expect(await chat.collectReply(sessionId)).toBeNull();
    const [held] = await chat.findReplies(organizationId, sessionId, 10);
    expect(held).toMatchObject({ deliveredVia: 'host' });
    expect(held.collectedAt).not.toBeNull();
  });

  it('delivers a reply once when the hook and the wake race for it', async () => {
    for (let round = 0; round < 10; round += 1) {
      const reply = await addReply(`round ${round}`);
      const [byHook, byHost] = await Promise.all([
        chat.collectReply(sessionId),
        chat.claimReplyForHost(sessionId, reply.id),
      ]);
      expect([byHook, byHost].filter(Boolean)).toHaveLength(1);
    }
  });

  it('hands a send the host did not make back to the hook, and leaves the hook’s own alone', async () => {
    const sent = await addReply('first');
    await chat.claimReplyForHost(sessionId, sent.id);
    await chat.releaseHostClaim(sessionId, sent.id);
    expect((await chat.collectReply(sessionId))?.id).toBe(sent.id);

    // A release that comes after the hook took it changes nothing.
    await chat.releaseHostClaim(sessionId, sent.id);
    const [held] = await chat.findReplies(organizationId, sessionId, 10);
    expect(held).toMatchObject({ id: sent.id, deliveredVia: 'hook' });
  });

  it('claims a reply only for its own session', async () => {
    const reply = await addReply();
    expect(await chat.claimReplyForHost(randomUUID(), reply.id)).toBeNull();
  });
});
