import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { SessionTurnOrmEntity } from '../database/session-turn.orm-entity';
import { SessionUsageRepository } from '../database/session-usage.repository';
import type { SessionUsageWeek } from '../database/session-usage.repository.port';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * `SessionUsageReader.weeklyUsage` against the schema the migrations build: the
 * range and the weeks are cut in the caller's zone (Europe/Madrid here, across
 * the 2026-10-25 change from CEST to CET), a turn's project is its session's,
 * turns that reported no model group under `null`, and nothing outside the
 * range, still live, or in another workspace is counted. The bigint-to-number
 * reading of each row is `work-session-mapper-usage.spec.ts`.
 */
describe('sessions: weekly turn usage (integration)', () => {
  const timeZone = 'Europe/Madrid';
  let dataSource: DataSource;
  let reader: SessionUsageRepository;

  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  // Fixed order, so the expected rows can be written in the reader's order.
  const [firstProjectId, secondProjectId] = [randomUUID(), randomUUID()].sort();
  const otherProjectId = randomUUID();
  const userId = randomUUID();
  const hostId = randomUUID();

  interface Turn {
    endedAt: string | null;
    model?: string;
    tokens?: [number, number, number, number];
    costUsd?: number;
  }

  async function seedSession(orgId: string, projectId: string, turns: Turn[]): Promise<void> {
    const sessionId = randomUUID();
    await dataSource.query(
      `INSERT INTO "work_session"
         ("id", "organizationId", "projectId", "createdByUserId", "hostId", "name", "slug",
          "agent", "state")
       VALUES ($1, $2, $3, $4, $5, 'usage', $6, 'claude-code', 'open')`,
      [sessionId, orgId, projectId, userId, hostId, `usage-${sessionId.slice(0, 8)}`],
    );
    for (const [index, turn] of turns.entries()) {
      await dataSource.query(
        `INSERT INTO "session_turn"
           ("organizationId", "sessionId", "seq", "origin", "drive", "state", "endedAt",
            "model", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens",
            "costUsd")
         VALUES ($1, $2, $3, 'person', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          orgId,
          sessionId,
          index + 1,
          turn.model ? 'headless' : 'interactive',
          turn.endedAt ? 'completed' : 'in_progress',
          turn.endedAt,
          turn.model ?? null,
          ...(turn.tokens ?? [null, null, null, null]),
          turn.costUsd ?? null,
        ],
      );
    }
  }

  beforeAll(async () => {
    const db = await useTestDatabase();

    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [SessionTurnOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    reader = new SessionUsageRepository(
      dataSource.getRepository(SessionTurnOrmEntity),
      new WorkSessionMapper(),
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
    for (const id of [organizationId, otherOrganizationId]) {
      await dataSource.query(
        `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
        [id, `acme-${id.slice(0, 8)}`],
      );
    }
    for (const [id, orgId, slug] of [
      [firstProjectId, organizationId, 'web'],
      [secondProjectId, organizationId, 'mobile'],
      [otherProjectId, otherOrganizationId, 'web'],
    ]) {
      await dataSource.query(
        `INSERT INTO "project" ("id", "organizationId", "name", "slug") VALUES ($1, $2, $3, $3)`,
        [id, orgId, slug],
      );
    }

    // Madrid is UTC+2 until 03:00 on Sunday 2026-10-25, UTC+1 after.
    await seedSession(organizationId, firstProjectId, [
      // Mon 19 Oct 00:30 CEST: the first minute of the range in Madrid, still Sunday in UTC.
      {
        endedAt: '2026-10-18T22:30:00Z',
        model: 'claude-sonnet-4-5',
        tokens: [100, 10, 1000, 50],
        costUsd: 0.1,
      },
      // Sun 18 Oct 23:30 CEST: the day before the range.
      { endedAt: '2026-10-18T21:30:00Z', model: 'claude-sonnet-4-5', tokens: [9, 9, 9, 9] },
      // Sun 25 Oct 23:30 CET, after the change: still the first week. With the
      // summer offset it would be Monday 00:30, the next one.
      {
        endedAt: '2026-10-25T22:30:00Z',
        model: 'claude-sonnet-4-5',
        tokens: [200, 20, 2000, 100],
        costUsd: 0.2,
      },
      // Mon 26 Oct 00:30 CET: the second week.
      {
        endedAt: '2026-10-25T23:30:00Z',
        model: 'claude-sonnet-4-5',
        tokens: [1, 2, 3, 4],
        costUsd: 0.01,
      },
      // An interactive turn: counted, measured as nothing, under no model.
      { endedAt: '2026-10-20T10:00:00Z' },
      // A live turn has not ended, so no week holds it.
      { endedAt: null },
      // Mon 2 Nov 00:00 CET: the first instant after the range.
      { endedAt: '2026-11-01T23:00:00Z', model: 'claude-sonnet-4-5', tokens: [7, 7, 7, 7] },
      // Sun 1 Nov 23:59:59 CET: the last second of it.
      {
        endedAt: '2026-11-01T22:59:59Z',
        model: 'claude-sonnet-4-5',
        tokens: [10, 10, 10, 10],
        costUsd: 0.05,
      },
    ]);
    await seedSession(organizationId, secondProjectId, [
      {
        endedAt: '2026-10-21T10:00:00Z',
        model: 'claude-opus-4-1',
        tokens: [5, 6, 7, 8],
        costUsd: 1.5,
      },
    ]);
    await seedSession(otherOrganizationId, otherProjectId, [
      {
        endedAt: '2026-10-21T10:00:00Z',
        model: 'claude-sonnet-4-5',
        tokens: [1000, 1000, 1000, 1000],
      },
    ]);
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  const week = (row: Omit<SessionUsageWeek, 'costUsd'> & { costUsd: number }) => ({
    ...row,
    costUsd: expect.closeTo(row.costUsd, 6),
  });

  it('buckets each turn in its Monday-to-Sunday week in the zone, across a DST change', async () => {
    const rows = await reader.weeklyUsage({
      organizationId,
      from: '2026-10-19',
      to: '2026-11-01',
      timeZone,
    });

    expect(rows).toEqual([
      week({
        weekStart: '2026-10-19',
        projectId: firstProjectId,
        model: null,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0,
        turns: 1,
      }),
      week({
        weekStart: '2026-10-19',
        projectId: firstProjectId,
        model: 'claude-sonnet-4-5',
        inputTokens: 300,
        outputTokens: 30,
        cacheReadTokens: 3000,
        cacheWriteTokens: 150,
        costUsd: 0.3,
        turns: 2,
      }),
      week({
        weekStart: '2026-10-19',
        projectId: secondProjectId,
        model: 'claude-opus-4-1',
        inputTokens: 5,
        outputTokens: 6,
        cacheReadTokens: 7,
        cacheWriteTokens: 8,
        costUsd: 1.5,
        turns: 1,
      }),
      week({
        weekStart: '2026-10-26',
        projectId: firstProjectId,
        model: 'claude-sonnet-4-5',
        inputTokens: 11,
        outputTokens: 12,
        cacheReadTokens: 13,
        cacheWriteTokens: 14,
        costUsd: 0.06,
        turns: 2,
      }),
    ]);
  });

  it('cuts the range in the zone it is given, not in UTC', async () => {
    const rows = await reader.weeklyUsage({
      organizationId,
      from: '2026-10-19',
      to: '2026-10-19',
      timeZone: 'UTC',
    });
    // In UTC the 00:30-CEST turn ended on the 18th, and nothing else is on the 19th.
    expect(rows).toEqual([]);
  });

  it('reads one project through its sessions', async () => {
    const rows = await reader.weeklyUsage({
      organizationId,
      projectId: secondProjectId,
      from: '2026-10-19',
      to: '2026-11-01',
      timeZone,
    });
    expect(rows.map(({ projectId, model, turns }) => ({ projectId, model, turns }))).toEqual([
      { projectId: secondProjectId, model: 'claude-opus-4-1', turns: 1 },
    ]);
  });

  it('answers nothing for a period with no ended turn, or one that ends before it starts', async () => {
    await expect(
      reader.weeklyUsage({ organizationId, from: '2026-12-01', to: '2026-12-31', timeZone }),
    ).resolves.toEqual([]);
    await expect(
      reader.weeklyUsage({ organizationId, from: '2026-11-01', to: '2026-10-19', timeZone }),
    ).resolves.toEqual([]);
  });
});
