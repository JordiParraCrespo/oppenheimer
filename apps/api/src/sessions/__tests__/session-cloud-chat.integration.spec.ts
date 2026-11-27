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
import { SessionCloudRunOrmEntity } from '../database/session-cloud-run.orm-entity';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { adoptedCloudEntries, adoptionKey } from '../domain/session-log-entry.factory';
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
        SessionCloudRunOrmEntity,
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

  describe('as the browser extension reads and replies', () => {
    let cloudId: string;
    let cloudSessionId: string;

    /** A claude.ai session adopted the way `RecordCloudEventsCommandHandler` does it. */
    const adopt = async (): Promise<{ id: string; cloudId: string }> => {
      const [project]: { id: string }[] = await dataSource.query(
        `SELECT id FROM "project" WHERE "organizationId" = $1 LIMIT 1`,
        [organizationId],
      );
      const claudeId = `session_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const work = WorkSessionEntity.requestCloud({
        id: randomUUID(),
        cloudRun: null,
        organizationId,
        projectId: project.id,
        createdByUserId: authorId,
        slug: `calm-heron-${randomUUID().slice(0, 6)}`,
        agent: 'claude-code',
        name: 'Fix the login page',
        idempotencyKey: adoptionKey(claudeId),
      });
      const outcome = await sessions.createIfUnclaimed(
        work,
        adoptedCloudEntries({ userId: authorId, cloudSessionId: claudeId }),
      );
      return { id: outcome.session.id, cloudId: claudeId };
    };

    const entry = (uuid: string, text: string) =>
      JSON.stringify({ type: 'user', uuid, message: { role: 'user', content: text } });

    beforeEach(async () => {
      ({ id: cloudId, cloudId: cloudSessionId } = await adopt());
    });

    it('adopts a claude.ai session once, as a hostless cloud session that knows its claude.ai id', async () => {
      // Breaks if a second batch racing the first adopts the session again, or
      // if the adopted row lacks the id every cloud read finds it by.
      const again = await sessions.createIfUnclaimed(
        WorkSessionEntity.requestCloud({
          id: randomUUID(),
          cloudRun: null,
          organizationId,
          projectId: (
            await dataSource.query(`SELECT "projectId" FROM work_session WHERE id = $1`, [cloudId])
          )[0].projectId,
          createdByUserId: authorId,
          slug: `calm-heron-${randomUUID().slice(0, 6)}`,
          agent: 'claude-code',
          idempotencyKey: adoptionKey(cloudSessionId),
        }),
        adoptedCloudEntries({ userId: authorId, cloudSessionId }),
      );
      expect(again).toMatchObject({ created: false });
      expect(again.session.id).toBe(cloudId);
      const [row]: { hostId: string | null; place: string; agentSessionId: string }[] =
        await dataSource.query(
          `SELECT "hostId", place, "agentSessionId" FROM work_session WHERE id = $1`,
          [cloudId],
        );
      expect(row).toEqual({ hostId: null, place: 'cloud', agentSessionId: cloudSessionId });
    });

    it('keeps each event once, in order, and replaces the hook’s copy with the first batch', async () => {
      // The hook got there first: its lines are what the chat read until now.
      expect(await chat.appendLines(organizationId, cloudId, 0, ['{"hook":0}', '{"hook":1}'])).toBe(
        2,
      );
      expect(await chat.findSource(cloudId)).toBe('hook');

      const first = [
        { id: 'e1', line: entry('e1', 'Fix the login page') },
        { id: 'e2', line: entry('e2', 'On it') },
        { id: 'e1', line: entry('e1', 'Fix the login page') },
      ];
      // Breaks if a resent or doubled event is stored twice, or the hook's
      // lines stay beside claude.ai's and the chat shows the turn twice.
      expect(await chat.appendEvents(organizationId, cloudId, first)).toBe(2);
      expect(await chat.appendEvents(organizationId, cloudId, first.slice(0, 2))).toBe(0);
      expect(
        await chat.appendEvents(organizationId, cloudId, [
          { id: 'e2', line: entry('e2', 'On it') },
          { id: 'e3', line: entry('e3', 'Also the signup page') },
        ]),
      ).toBe(1);
      expect(await chat.findSource(cloudId)).toBe('browser');
      const lines = await chat.findLines(cloudId, 0, 10);
      expect(lines.map((each) => each.seq)).toEqual([0, 1, 2]);
      expect(lines.map((each) => JSON.parse(each.line).uuid)).toEqual(['e1', 'e2', 'e3']);

      // Breaks if the hook, still running in the session, writes its own
      // numbering into lines the extension now owns.
      expect(await chat.appendLines(organizationId, cloudId, 2, ['{"hook":2}', '{"hook":3}'])).toBe(
        0,
      );
      expect(await chat.findLines(cloudId, 0, 10)).toHaveLength(3);
    });

    it('numbers two batches written at once without a gap or a clash', async () => {
      const batch = (from: number) =>
        Array.from({ length: 20 }, (_, i) => ({
          id: `e${from + i}`,
          line: entry(`e${from + i}`, 'x'),
        }));
      const [a, b] = await Promise.all([
        chat.appendEvents(organizationId, cloudId, batch(0)),
        chat.appendEvents(organizationId, cloudId, batch(10)),
      ]);
      expect(a + b).toBe(30);
      const seqs = (await chat.findLines(cloudId, 0, 100)).map((each) => each.seq);
      expect(seqs).toEqual(Array.from({ length: 30 }, (_, i) => i));
    });

    it('hands the extension its person’s waiting replies in open Claude Code cloud sessions only', async () => {
      const mine = await chat.addReply(
        organizationId,
        cloudId,
        authorId,
        'Also the signup page',
        new Date(),
      );
      // The worktree session of the outer fixture has no claude.ai id: never the extension's.
      await chat.addReply(organizationId, sessionId, authorId, 'not a cloud session', new Date());
      const someoneElse = randomUUID();
      await dataSource.query(
        `INSERT INTO "user" ("id", "email", "name", "firstName", "lastName", "emailVerified")
         VALUES ($1, $2, 'Bo', 'Bo', 'Li', true)`,
        [someoneElse, `${someoneElse}@example.com`],
      );
      await chat.addReply(organizationId, cloudId, someoneElse, 'not yours to post', new Date());

      // Breaks if the extension posts as its person a reply someone else typed,
      // or claims replies for a session it cannot post to.
      const claimed = await chat.claimRepliesForBrowser(organizationId, authorId, 60);
      expect(claimed.map((reply) => [reply.id, reply.cloudSessionId, reply.text])).toEqual([
        [mine.id, cloudSessionId, 'Also the signup page'],
      ]);
      expect(claimed[0].deliveredVia).toBe('browser');
      expect(await chat.claimRepliesForBrowser(organizationId, authorId, 60)).toEqual([]);
      // Breaks if the Stop hook or a host can still deliver it a second time.
      expect(await chat.claimReplyForHost(cloudId, mine.id)).toBeNull();
      expect((await chat.collectReply(cloudId))?.text).toBe('not yours to post');
    });

    it('hands a reply claude.ai refused back to the hook, and only the extension’s own claim', async () => {
      const reply = await chat.addReply(organizationId, cloudId, authorId, 'retry me', new Date());
      await chat.claimRepliesForBrowser(organizationId, authorId, 60);
      // Breaks if a refused post is lost: it has to wait for the hook again.
      expect(await chat.releaseBrowserClaim(organizationId, authorId, reply.id)).toBe(true);
      expect((await chat.collectReply(cloudId))?.id).toBe(reply.id);
      // Breaks if a late release takes back a reply the hook delivered.
      expect(await chat.releaseBrowserClaim(organizationId, authorId, reply.id)).toBe(false);
      const [held] = await chat.findReplies(organizationId, cloudId, 10);
      expect(held).toMatchObject({ deliveredVia: 'hook' });
    });

    it('gives a reply to one of the extension, the hook and a host when they race for it', async () => {
      for (let round = 0; round < 10; round += 1) {
        const reply = await chat.addReply(
          organizationId,
          cloudId,
          authorId,
          `round ${round}`,
          new Date(),
        );
        const [byBrowser, byHook, byHost] = await Promise.all([
          chat.claimRepliesForBrowser(organizationId, authorId, 60),
          chat.collectReply(cloudId),
          chat.claimReplyForHost(cloudId, reply.id),
        ]);
        expect(
          [byBrowser.length > 0, Boolean(byHook), Boolean(byHost)].filter(Boolean),
        ).toHaveLength(1);
      }
    });

    it('gives a claim the extension never confirmed back to the hook once its lease lapses', async () => {
      const reply = await chat.addReply(
        organizationId,
        cloudId,
        authorId,
        'lost in transit',
        new Date(),
      );
      // A lease already over: the claim's answer was lost, or Chrome stopped the worker.
      await chat.claimRepliesForBrowser(organizationId, authorId, -1);
      // Breaks if the console draws a reply nobody posted as sent, forever.
      const [seen] = await chat.findReplies(organizationId, cloudId, 10);
      expect(seen).toMatchObject({ id: reply.id, collectedAt: null, deliveredVia: null });
      // Breaks if the hook, a host or the extension can never deliver it again.
      expect((await chat.collectReply(cloudId))?.id).toBe(reply.id);
      expect(await chat.confirmBrowserDelivery(organizationId, authorId, reply.id)).toBe(false);
    });

    it('keeps a claim claude.ai took, so nothing delivers it twice', async () => {
      const reply = await chat.addReply(organizationId, cloudId, authorId, 'posted', new Date());
      await chat.claimRepliesForBrowser(organizationId, authorId, 60);
      expect(await chat.confirmBrowserDelivery(organizationId, authorId, reply.id)).toBe(true);
      // Confirmed, its lease is gone: even a claim that would have lapsed stays.
      await dataSource.query(
        `UPDATE session_cloud_reply SET "createdAt" = now() - interval '1 hour' WHERE id = $1`,
        [reply.id],
      );
      expect(await chat.collectReply(cloudId)).toBeNull();
      expect(await chat.claimRepliesForBrowser(organizationId, authorId, 60)).toEqual([]);
      const [seen] = await chat.findReplies(organizationId, cloudId, 10);
      expect(seen).toMatchObject({ id: reply.id, deliveredVia: 'browser' });
    });
  });
});
