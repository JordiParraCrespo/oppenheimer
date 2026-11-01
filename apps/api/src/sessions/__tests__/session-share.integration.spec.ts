import { randomUUID } from 'node:crypto';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource, type EntityManager } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { SessionCheckoutOrmEntity } from '../database/session-checkout.orm-entity';
import { SessionShareOrmEntity } from '../database/session-share.orm-entity';
import { SessionShareRepository } from '../database/session-share.repository';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { SessionShareEntity, type SessionShareSettings } from '../domain/session-share.entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { SessionShareMapper } from '../session-share.mapper';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * The share repository's own SQL, against the migrations: one share per
 * session, kept at its first address when two first shares race, and the
 * table's `CHECK`s holding the rules the aggregate states (a link only
 * watches, write access ends within a day) for any writer that skips it.
 */
describe('sessions: sharing a session (integration)', () => {
  let dataSource: DataSource;
  let shares: SessionShareRepository;
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

  const share = (sessionId: string, settings: Partial<SessionShareSettings> = {}) =>
    SessionShareEntity.share({
      organizationId,
      sessionId,
      sharedByUserId: userId,
      settings: { audience: 'link', access: 'read', lifetime: '24h', ...settings },
    });

  beforeAll(async () => {
    const db = await useTestDatabase();

    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        WorkSessionOrmEntity,
        SessionCheckoutOrmEntity,
        WorkSessionEventOrmEntity,
        SessionShareOrmEntity,
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
    shares = new SessionShareRepository(
      dataSource.getRepository(SessionShareOrmEntity),
      new SessionShareMapper(),
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

  it('stores a share and finds it by its session and by its address', async () => {
    const work = await liveSession();
    const stored = await shares.upsert(
      share(work.id, {
        audience: 'people',
        people: ['Ada@Example.com'],
        access: 'write',
        lifetime: '1h',
      }),
    );

    const bySlug = (await shares.findOneBySlug(stored.slug)).unwrap();
    expect(bySlug).toMatchObject({
      audience: 'people',
      access: 'write',
      people: ['ada@example.com'],
    });
    expect((await shares.findOneBySession(organizationId, work.id)).unwrap().id).toBe(stored.id);
  });

  it('keeps one share per session: a second first share lands on the first one’s address', async () => {
    const work = await liveSession();
    const first = await shares.upsert(share(work.id));
    const second = await shares.upsert(share(work.id, { lifetime: '8h' }));

    expect(second.id).toBe(first.id);
    expect(second.slug).toBe(first.slug);
    const [{ rows }] = await dataSource.query(
      `SELECT count(*)::int AS "rows" FROM session_share WHERE "sessionId" = $1`,
      [work.id],
    );
    expect(rows).toBe(1);
  });

  it('opens nothing at the old address once stopped', async () => {
    const work = await liveSession();
    const stored = await shares.upsert(share(work.id));
    await shares.delete(stored);
    expect((await shares.findOneBySlug(stored.slug)).isNone()).toBe(true);
  });

  it('refuses, in the table, a link that types and write access past a day', async () => {
    const work = await liveSession();
    const stored = await shares.upsert(share(work.id));
    // Regression guard: these rules are the aggregate's, and the CHECKs are
    // what holds them for a writer that does not go through it.
    await expect(
      dataSource.query(
        `UPDATE session_share SET access = 'write', "expiresAt" = now() WHERE id = $1`,
        [stored.id],
      ),
    ).rejects.toThrow(/CHK_session_share_link_reads/);
    await expect(
      dataSource.query(
        `UPDATE session_share SET audience = 'people', people = '{a@x.dev}', access = 'write',
           "expiresAt" = now() + interval '2 days' WHERE id = $1`,
        [stored.id],
      ),
    ).rejects.toThrow(/CHK_session_share_write_expires/);
  });

  it('goes with the session it shares', async () => {
    const work = await liveSession();
    const stored = await shares.upsert(share(work.id));
    await dataSource.query(`DELETE FROM work_session_event WHERE "sessionId" = $1`, [work.id]);
    await dataSource.query(`DELETE FROM work_session WHERE id = $1`, [work.id]);
    expect((await shares.findOneById(stored.id)).isNone()).toBe(true);
  });
});
