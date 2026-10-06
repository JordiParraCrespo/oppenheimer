import { randomUUID } from 'node:crypto';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { SYSTEM_ROLE_PERMISSIONS } from '@oppenheimer/shared';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, type EntityManager } from 'typeorm';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { ProjectOrmEntity } from '../../projects/database/project.orm-entity';
import { ProjectRepository } from '../../projects/database/project.repository';
import { ProjectRepositoryOrmEntity } from '../../projects/database/project-repository.orm-entity';
import { ProjectMapper } from '../../projects/project.mapper';
import { SessionCheckoutOrmEntity } from '../database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * The log, the fold and the composite keys, against a real Postgres: what the
 * **database** enforces. A foreign project is rejected by a constraint, not a check
 * somebody remembered; `seq` stays dense under concurrent appends; closing a session
 * leaves the row where it was. Each failure would mean a second directory, a second
 * branch or a stranger's conversation state.
 *
 * The schema is built by the migrations, not `synchronize`, so a bad migration fails
 * here rather than in production.
 */
describe('sessions: the log, the fold and the keys (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let repository: WorkSessionRepository;
  let organizationId: string;
  let otherOrganizationId: string;
  let projectId: string;
  let foreignProjectId: string;
  let installationId: string;
  let foreignInstallationId: string;
  let hostId: string;
  let userId: string;

  const scope = () => ({
    userId,
    organizationId,
    teamIds: [] as string[],
    grants: new Map<string, Set<string>>(),
    bypass: false,
  });

  /**
   * Nothing here asserts on the outbox: its transaction is the data source's
   * own, staging writes nothing, and there is no relay to wake.
   */
  const outbox = () =>
    ({
      transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
        dataSource.transaction(work),
      stageEvents: async () => undefined,
    }) as unknown as OutboxService;

  function session(overrides: Partial<{ idempotencyKey: string | null; slug: string }> = {}) {
    return WorkSessionEntity.request({
      organizationId,
      projectId,
      createdByUserId: userId,
      hostId,
      slug: overrides.slug ?? `bold-otter-${randomUUID().slice(0, 6)}`,
      agent: 'claude-code',
      idempotencyKey: overrides.idempotencyKey ?? null,
    });
  }

  function checkout(
    work: WorkSessionEntity,
    overrides: Partial<{
      installationId: string;
      githubRepoId: string;
      directoryName: string;
    }> = {},
  ) {
    return SessionCheckoutEntity.createNew({
      organizationId: work.organizationId,
      sessionId: work.id,
      installationId: overrides.installationId ?? installationId,
      githubRepoId: overrides.githubRepoId ?? '4242',
      repositoryFullName: 'acme/xrp-mobile',
      directoryName: overrides.directoryName ?? 'xrp-mobile',
      baseBranch: 'main',
      branch: `oppenheimer/xrp-mobile/${work.slug}`,
    });
  }

  const requested = (key = randomUUID()) => [
    {
      idempotencyKey: `session.requested:${key}`,
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

    // The migrations, not `synchronize`: a session's composite keys reference
    // the project, checkout and installation tables, and only the SQL has them.
    await runAllMigrations();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [
        WorkSessionOrmEntity,
        SessionCheckoutOrmEntity,
        WorkSessionEventOrmEntity,
        ProjectOrmEntity,
        ProjectRepositoryOrmEntity,
      ],
      synchronize: false,
    });
    await dataSource.initialize();

    repository = new WorkSessionRepository(
      dataSource.getRepository(WorkSessionOrmEntity),
      dataSource,
      new WorkSessionMapper(),
      outbox(),
      { publish: () => undefined },
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    otherOrganizationId = randomUUID();
    userId = randomUUID();
    hostId = randomUUID();

    for (const [id, name] of [
      [organizationId, 'Acme'],
      [otherOrganizationId, 'Other'],
    ] as const) {
      await dataSource.query(
        `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, $2, $3)`,
        [id, name, `${name.toLowerCase()}-${id.slice(0, 8)}`],
      );
    }

    await dataSource.query(
      `INSERT INTO "user" ("id", "email", "name", "firstName", "lastName", "emailVerified")
       VALUES ($1, $2, $3, $4, $5, false)`,
      [userId, `${userId}@example.com`, 'Jordi', 'Jordi', 'Parra'],
    );
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, $3, $4, $5)`,
      [hostId, userId, 'devbox', 'key', randomUUID()],
    );

    projectId = await insertProject(organizationId, 'xrp-mobile');
    foreignProjectId = await insertProject(otherOrganizationId, 'xrp-mobile');
    installationId = await insertInstallation(organizationId, 1);
    foreignInstallationId = await insertInstallation(otherOrganizationId, 2);
  });

  async function insertProject(org: string, slug: string): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "project" ("id", "organizationId", "name", "slug")
       VALUES ($1, $2, $3, $4)`,
      [id, org, slug, slug],
    );
    return id;
  }

  async function insertInstallation(org: string, githubId: number): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "github_installation"
         ("id", "organizationId", "githubInstallationId", "accountLogin", "accountType",
          "repositorySelection", "installedByUserId")
       VALUES ($1, $2, $3, $4, 'Organization', 'all', $5)`,
      [id, org, githubId + Math.floor(Math.random() * 1_000_000), 'acme', userId],
    );
    return id;
  }

  const events = (sessionId: string) =>
    dataSource.query(
      `SELECT "seq", "kind", "idempotencyKey", "source" FROM "work_session_event"
        WHERE "sessionId" = $1 ORDER BY "seq"`,
      [sessionId],
    ) as Promise<{ seq: number; kind: string; idempotencyKey: string; source: string }[]>;

  /** Every statement `run` sends to Postgres, in order. */
  async function statementsOf(run: () => Promise<unknown>): Promise<string[]> {
    const spy = vi.spyOn(PostgresQueryRunner.prototype, 'query');
    try {
      await run();
      return spy.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
    } finally {
      spy.mockRestore();
    }
  }

  const observed = (key: string) => ({
    idempotencyKey: key,
    source: 'runner' as const,
    kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
    payload: { state: 'working' },
  });

  describe('creating a session', () => {
    it('writes the row, its checkouts and the first entry of its log together', async () => {
      const work = session();
      const first = checkout(work);
      work.attachCheckout(first);

      const { created } = await repository.createIfUnclaimed(work, [
        ...requested(),
        {
          idempotencyKey: `cwd:${randomUUID()}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.CWD_SET,
          payload: { checkoutId: first.id },
        },
      ]);

      expect(created).toBe(true);
      const [row] = await dataSource.query(`SELECT * FROM "work_session" WHERE "id" = $1`, [
        work.id,
      ]);
      expect(row.state).toBe('starting');
      // The fold ran inside the same transaction as the insert, so the row is never
      // eventually-consistent with its own log.
      expect(row.lastEventAt).not.toBeNull();
      expect(row.cwdCheckoutId).toBe(first.id);
      expect((await events(work.id)).map((entry) => entry.kind)).toEqual([
        'session.requested',
        'session.cwd_set',
      ]);
    });

    it('returns the session a retry already created, and mints nothing new', async () => {
      const key = `idem-${randomUUID()}`;
      const first = session({ idempotencyKey: key });
      await repository.createIfUnclaimed(first, requested());

      // A different slug and a different id, with the same client key: the second
      // must not produce a second directory or a second branch.
      const second = session({ idempotencyKey: key });
      const outcome = await repository.createIfUnclaimed(second, requested());

      expect(outcome.created).toBe(false);
      expect(outcome.session.id).toBe(first.id);
      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int FROM "work_session" WHERE "organizationId" = $1`,
        [organizationId],
      );
      expect(count).toBe(1);
    });

    /**
     * The fold's columns are the projection, so **every** one must be written where
     * the fold runs. Regression: the append's row update hand-listed its
     * columns, so the four observation columns (the sidebar debounce's inputs) and
     * the three launch options reached the aggregate but never the row, unnoticed
     * because every assertion read the aggregate. So this one reads the row.
     */
    it('persists every column the fold projects, not the ones somebody listed', async () => {
      const work = session();
      const first = checkout(work);
      work.attachCheckout(first);

      await repository.createIfUnclaimed(work, [
        {
          idempotencyKey: `session.requested:${randomUUID()}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.REQUESTED,
          payload: {
            agent: 'claude-code',
            launch: { model: 'claude-opus-5-5', permission: 'auto', effort: 'high' },
          },
        },
        {
          idempotencyKey: `cwd:${randomUUID()}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.CWD_SET,
          payload: { checkoutId: first.id },
        },
        {
          idempotencyKey: `obs:${randomUUID()}`,
          source: 'runner',
          kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
          payload: { state: 'blocked' },
        },
        {
          idempotencyKey: `rep:${randomUUID()}`,
          source: 'runner',
          kind: SESSION_EVENT_KINDS.REPORT_PUBLISHED,
          payload: { hash: 'abc123' },
        },
      ]);

      const [row] = await dataSource.query(`SELECT * FROM "work_session" WHERE "id" = $1`, [
        work.id,
      ]);

      // The launch the request stated, which a restart and the engine button read.
      expect(row.launchModel).toBe('claude-opus-5-5');
      expect(row.launchPermission).toBe('auto');
      expect(row.launchEffort).toBe('high');
      // The observation columns the derived group is computed from.
      expect(row.lastObservedState).toBe('blocked');
      expect(row.reportHash).toBe('abc123');
      expect(row.ackedReportHash).toBeNull();

      // And the row agrees with a replay of its own log, which is the property
      // all of this exists to keep.
      const replayed = await repository.findOneById(scope(), work.id);
      expect(replayed.isSome()).toBe(true);
      expect(replayed.unwrap().launch).toEqual({
        model: 'claude-opus-5-5',
        permission: 'auto',
        effort: 'high',
      });
    });

    it('lets two sessions with no idempotency key both land', async () => {
      // The partial unique is `WHERE "idempotencyKey" IS NOT NULL`: absent header,
      // absent protection — not a constraint several nulls collide on.
      await repository.createIfUnclaimed(session(), requested());
      await repository.createIfUnclaimed(session(), requested());

      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int FROM "work_session" WHERE "organizationId" = $1`,
        [organizationId],
      );
      expect(count).toBe(2);
    });
  });

  describe('points in time (#61)', () => {
    it('reads a session touched now as now, whatever zone the writer was in', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      // UTC+14: a zoneless column keeps the wall clock and loses the offset, so
      // it would come back fourteen hours in the future.
      const [[updated]]: [{ updatedAt: Date }[], number] = await dataSource.transaction(
        async (manager) => {
          await manager.query(`SET LOCAL TIME ZONE 'Pacific/Kiritimati'`);
          return manager.query(
            `UPDATE "work_session" SET "updatedAt" = now() WHERE "id" = $1 RETURNING "updatedAt"`,
            [work.id],
          );
        },
      );
      expect(Math.abs(updated.updatedAt.getTime() - Date.now())).toBeLessThan(60_000);
    });
  });

  describe('the composite keys', () => {
    it('rejects a session in another workspace’s project', async () => {
      // Not a handler check: the constraint makes it unrepresentable.
      await expect(
        dataSource.query(
          `INSERT INTO "work_session"
             ("id", "organizationId", "projectId", "createdByUserId", "hostId", "name", "slug", "agent")
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'claude-code')`,
          [
            randomUUID(),
            organizationId,
            foreignProjectId,
            userId,
            hostId,
            'x',
            'bold-otter-000001',
          ],
        ),
      ).rejects.toThrow(/FK_work_session_project|foreign key/i);
    });

    it('rejects a checkout through another workspace’s installation', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      await expect(
        repository.insertCheckout(
          work,
          checkout(work, { installationId: foreignInstallationId }),
          [],
        ),
      ).rejects.toThrow(/FK_session_checkout_installation|foreign key/i);
    });

    it('refuses to unpair a host that still has sessions on it', async () => {
      // `ON DELETE RESTRICT`, because a host is a person's and the work on it is the
      // workspace's: deleting one must not evaporate the other.
      await repository.createIfUnclaimed(session(), requested());
      await expect(
        dataSource.query(`DELETE FROM "host" WHERE "id" = $1`, [hostId]),
      ).rejects.toThrow(/foreign key|violates/i);
    });
  });

  describe('appending to the log', () => {
    it('keeps seq dense under concurrent batches', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      // Every appender takes the same row lock, so they serialise. Without it two
      // batches read the same maximum and the log develops a gap or a duplicate.
      await Promise.all(
        Array.from({ length: 6 }, (_, batch) =>
          repository.appendEvents(work, [
            {
              idempotencyKey: `run-a:${batch}`,
              source: 'runner',
              kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
              payload: { state: 'working' },
            },
            {
              idempotencyKey: `run-b:${batch}`,
              source: 'runner',
              kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
              payload: { state: 'working' },
            },
          ]),
        ),
      );

      const log = await events(work.id);
      expect(log).toHaveLength(13);
      expect(log.map((entry) => entry.seq)).toEqual(
        Array.from({ length: 13 }, (_, index) => index + 1),
      );
    });

    it('appends only what a replayed batch had not landed', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());
      const batch = [
        {
          idempotencyKey: 'run-1:1',
          source: 'runner' as const,
          kind: SESSION_EVENT_KINDS.STARTED,
          payload: {},
        },
      ];

      const first = await repository.appendEvents(work, batch);
      const replay = await repository.appendEvents(work, batch);

      // Both attempts accept the key: see `SessionAppendOutcome`.
      expect(first.accepted).toEqual(['run-1:1']);
      expect(replay.accepted).toEqual(['run-1:1']);
      expect(replay.appended).toHaveLength(0);
      expect(await events(work.id)).toHaveLength(2);
    });

    it('folds the log onto the row in the same transaction', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      await repository.appendEvents(work, [
        {
          idempotencyKey: 'run-1:1',
          source: 'runner',
          kind: SESSION_EVENT_KINDS.STARTED,
          payload: { agentSessionId: 'agent-9' },
        },
      ]);

      const [row] = await dataSource.query(`SELECT * FROM "work_session" WHERE "id" = $1`, [
        work.id,
      ]);
      expect(row.state).toBe('open');
      expect(row.stateSeq).toBe(1);
      expect(row.agentSessionId).toBe('agent-9');
    });

    it('refuses one oversized payload without refusing the batch', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      const outcome = await repository.appendEvents(work, [
        {
          idempotencyKey: 'run-1:1',
          source: 'runner',
          kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
          payload: { blob: 'x'.repeat(9_000) },
        },
        {
          idempotencyKey: 'run-1:2',
          source: 'runner',
          kind: SESSION_EVENT_KINDS.STARTED,
          payload: {},
        },
      ]);

      expect(outcome.rejected.map((row) => row.idempotencyKey)).toEqual(['run-1:1']);
      expect(outcome.accepted).toEqual(['run-1:2']);
      expect((await events(work.id)).map((entry) => entry.seq)).toEqual([1, 2]);
    });

    it('appends a batch in one insert, and reads nothing outside the transaction', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());
      const batch = Array.from({ length: 10 }, (_, n) => observed(`run-1:${n}`));

      const sql = await statementsOf(() => repository.appendEventsForHost(hostId, work.id, batch));

      expect(
        sql.filter((statement) => statement.includes('INSERT INTO "work_session_event"')),
      ).toHaveLength(1);
      // The transaction is the whole of it: lock, latest turn, the insert, the
      // row, then only the turns the fold moved — no read before it, and no
      // statement per event.
      expect(sql[0]).toMatch(/^START TRANSACTION/);
      expect(sql.at(-1)).toBe('COMMIT');
      const inside = sql.slice(1, -1);
      expect(inside[0]).toMatch(/^SELECT \* FROM "work_session" WHERE "id" = \$1 FOR UPDATE$/);
      expect(inside[1]).toMatch(/^SELECT \* FROM "session_turn"/);
      expect(inside[2]).toMatch(/INSERT INTO "work_session_event"/);
      expect(inside[3]).toMatch(/^UPDATE "work_session"/);
      expect(
        inside.slice(4).every((statement) => statement.startsWith('INSERT INTO "session_turn"')),
      ).toBe(true);
      expect(inside.length).toBeLessThanOrEqual(5);
      expect((await events(work.id)).map((entry) => entry.seq)).toEqual(
        Array.from({ length: 11 }, (_, index) => index + 1),
      );
    });

    it('lands an in-batch duplicate key once, with no gap', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      const outcome = await repository.appendEvents(work, [
        observed('run-1:1'),
        { ...observed('run-1:2'), payload: { state: 'idle' } },
        { ...observed('run-1:1'), payload: { state: 'second copy' } },
        observed('run-1:3'),
      ]);

      expect(outcome.accepted).toEqual(['run-1:1', 'run-1:2', 'run-1:1', 'run-1:3']);
      expect(outcome.appended.map((entry) => [entry.seq, entry.idempotencyKey])).toEqual([
        [2, 'run-1:1'],
        [3, 'run-1:2'],
        [4, 'run-1:3'],
      ]);
      const log = await events(work.id);
      expect(log.map((entry) => entry.seq)).toEqual([1, 2, 3, 4]);
      // The first occurrence is the one that landed.
      const [first] = await dataSource.query(
        `SELECT "payload" FROM "work_session_event" WHERE "sessionId" = $1 AND "idempotencyKey" = 'run-1:1'`,
        [work.id],
      );
      expect(first.payload).toEqual({ state: 'working' });
    });

    it('rejects every key for a session on another host, and for a missing one, alike', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      const elsewhere = await repository.appendEventsForHost(randomUUID(), work.id, [
        observed('run-1:1'),
      ]);
      const missing = await repository.appendEventsForHost(hostId, randomUUID(), [
        observed('run-1:1'),
      ]);

      expect(elsewhere.isNone()).toBe(true);
      expect(missing.isNone()).toBe(true);
      expect(await events(work.id)).toHaveLength(1);
    });

    it('folds a host append onto the locked row, and hands back the session it built', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      const appended = await repository.appendEventsForHost(hostId, work.id, [
        {
          idempotencyKey: 'run-1:1',
          source: 'runner',
          kind: SESSION_EVENT_KINDS.STARTED,
          payload: { agentSessionId: 'agent-9' },
        },
      ]);

      const { session: folded, outcome } = appended.unwrap();
      expect(folded.id).toBe(work.id);
      expect(folded.state).toBe('open');
      expect(outcome.appended.map((entry) => entry.seq)).toEqual([2]);
      const [row] = await dataSource.query(`SELECT * FROM "work_session" WHERE "id" = $1`, [
        work.id,
      ]);
      expect(row.state).toBe('open');
      expect(row.agentSessionId).toBe('agent-9');
    });

    it('keeps seq dense when two coalesced appends race a third', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      // What the link sends when it coalesces: several batches' events in one
      // append, raced here against a lone batch and against a replay of the first.
      const coalesced = (run: string) =>
        [1, 2, 3].map((n) => observed(`${run}:${n}`)) as ReturnType<typeof observed>[];
      const outcomes = await Promise.all([
        repository.appendEventsForHost(hostId, work.id, coalesced('run-a')),
        repository.appendEventsForHost(hostId, work.id, coalesced('run-b')),
        repository.appendEventsForHost(hostId, work.id, [observed('run-c:1')]),
        repository.appendEventsForHost(hostId, work.id, coalesced('run-a')),
      ]);

      expect(outcomes.every((outcome) => outcome.isSome())).toBe(true);
      const log = await events(work.id);
      expect(log.map((entry) => entry.seq)).toEqual(
        Array.from({ length: 8 }, (_, index) => index + 1),
      );
      expect(new Set(log.map((entry) => entry.idempotencyKey)).size).toBe(8);
      // Each append's own events are consecutive: a batch is numbered as one.
      for (const run of ['run-a', 'run-b']) {
        const seqs = log.filter((entry) => entry.idempotencyKey.startsWith(run)).map((e) => e.seq);
        expect(seqs).toEqual([seqs[0], seqs[0] + 1, seqs[0] + 2]);
      }
    });
  });

  describe('nothing is ever hard-deleted', () => {
    it('keeps the row and its slug when the host reports a close', async () => {
      const work = session({ slug: 'bold-otter-abc123' });
      await repository.createIfUnclaimed(work, requested());

      await repository.appendEvents(work, [
        {
          idempotencyKey: 'close:1',
          source: 'api',
          kind: SESSION_EVENT_KINDS.CLOSED,
          payload: {},
        },
      ]);

      const [row] = await dataSource.query(`SELECT * FROM "work_session" WHERE "id" = $1`, [
        work.id,
      ]);
      expect(row.state).toBe('resolved');
      expect(row.stoppedAt).not.toBeNull();

      // The tombstone: the slug cannot be taken again in this workspace, which is
      // what stops a new session inheriting a retired agent's conversation state.
      await expect(
        dataSource.query(
          `INSERT INTO "work_session"
             ("id", "organizationId", "projectId", "createdByUserId", "hostId", "name", "slug", "agent")
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'claude-code')`,
          [randomUUID(), organizationId, projectId, userId, hostId, 'x', 'bold-otter-abc123'],
        ),
      ).rejects.toThrow(/UQ_work_session_organization_slug|duplicate key/i);
    });

    it('nulls cwdCheckoutId when the checkout the agent was in is retired', async () => {
      const work = session();
      const first = checkout(work);
      work.attachCheckout(first);
      await repository.createIfUnclaimed(work, [
        ...requested(),
        {
          idempotencyKey: `cwd:${randomUUID()}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.CWD_SET,
          payload: { checkoutId: first.id },
        },
      ]);
      const [created] = await dataSource.query(
        `SELECT "cwdCheckoutId" FROM "work_session" WHERE "id" = $1`,
        [work.id],
      );
      expect(created.cwdCheckoutId).toBe(first.id);

      await repository.retireCheckout(work, first, [
        {
          idempotencyKey: 'remove:1',
          source: 'api',
          kind: SESSION_EVENT_KINDS.CHECKOUT_REMOVED,
          payload: { checkoutId: first.id },
        },
      ]);

      const [row] = await dataSource.query(`SELECT * FROM "work_session" WHERE "id" = $1`, [
        work.id,
      ]);
      expect(row.cwdCheckoutId).toBeNull();
      // The checkout row itself stays, with its directory name out of circulation.
      const [kept] = await dataSource.query(`SELECT * FROM "session_checkout" WHERE "id" = $1`, [
        first.id,
      ]);
      expect(kept.removedAt).not.toBeNull();
    });

    it('lets a repository be re-added, on a directory name it has not used', async () => {
      const work = session();
      const first = checkout(work);
      work.attachCheckout(first);
      await repository.createIfUnclaimed(work, requested());

      await repository.retireCheckout(work, first, [
        {
          idempotencyKey: `remove:${randomUUID()}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.CHECKOUT_REMOVED,
          payload: { checkoutId: first.id },
        },
      ]);

      // The repository unique is partial on `removedAt IS NULL`, so the same
      // repository may come back — but the directory unique is not, so it comes back
      // under a different name.
      const again = checkout(work, { directoryName: 'acme--xrp-mobile' });
      work.attachCheckout(again);
      await expect(repository.insertCheckout(work, again, [])).resolves.toBeDefined();

      await expect(
        repository.insertCheckout(work, checkout(work, { githubRepoId: '77' }), []),
      ).rejects.toThrow(/UQ_session_checkout_session_directory|duplicate key/i);
    });
  });

  describe('reading', () => {
    it('does not show one workspace’s sessions to another', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      const mine = await repository.findOneById(scope(), work.id);
      expect(mine.isSome()).toBe(true);

      const theirs = await repository.findOneById(
        { ...scope(), organizationId: otherOrganizationId },
        work.id,
      );
      expect(theirs.isNone()).toBe(true);
    });

    it('counts what stops a project being archived', async () => {
      const open = session();
      await repository.createIfUnclaimed(open, requested());
      expect(await repository.countUnresolvedForProject(scope(), projectId)).toBe(1);

      await repository.appendEvents(open, [
        { idempotencyKey: 'close:1', source: 'api', kind: SESSION_EVENT_KINDS.CLOSED, payload: {} },
      ]);
      expect(await repository.countUnresolvedForProject(scope(), projectId)).toBe(0);
    });

    it('pages the log by seq', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());
      await repository.appendEvents(
        work,
        Array.from({ length: 4 }, (_, index) => ({
          idempotencyKey: `run-1:${index}`,
          source: 'runner' as const,
          kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
          payload: { state: 'working' },
        })),
      );

      const first = await repository.findEvents(work, undefined, 2);
      expect(first.events.map((event) => event.seq)).toEqual([1, 2]);
      expect(first.nextSeq).toBe(2);

      const last = await repository.findEvents(work, 3, 10);
      expect(last.events.map((event) => event.seq)).toEqual([4, 5]);
      expect(last.nextSeq).toBeNull();
    });

    describe('the session list', () => {
      const mapper = new WorkSessionMapper();

      async function sessions(count: number): Promise<WorkSessionEntity[]> {
        const made: WorkSessionEntity[] = [];
        for (let n = 0; n < count; n += 1) {
          const work = session();
          await repository.createIfUnclaimed(work, requested());
          made.push(work);
        }
        return made;
      }

      /** Every page by cursor, the way the console walks it, calling `between` after each. */
      async function walk(
        sort: 'recent' | 'oldest' | 'name',
        between: (page: number) => Promise<void> = async () => undefined,
      ): Promise<string[]> {
        const seen: string[] = [];
        let cursor: string | undefined;
        for (let page = 1; page < 50; page += 1) {
          const result = await repository.findAllPaginated(scope(), {
            page: 1,
            limit: 100,
            sort,
            cursor: cursor ? mapper.fromListCursor(cursor, sort) : undefined,
          });
          // The first page is a page; every one after it is a cursor's, uncounted.
          if (cursor) expect(result.total).toBeUndefined();
          seen.push(...result.data.map((work) => work.id));
          if (!result.nextCursor) return seen;
          // Through the wire format, so the encoding round-trips too.
          cursor = mapper.toListCursor(result.nextCursor);
          await between(page);
        }
        throw new Error('the walk did not end');
      }

      it('walks 250 sessions by cursor, each exactly once, in every order', async () => {
        const made = await sessions(250);
        const ids = made.map((work) => work.id).sort();
        for (const sort of ['recent', 'oldest', 'name'] as const) {
          const seen = await walk(sort);
          expect(seen).toHaveLength(250);
          expect([...seen].sort()).toEqual(ids);
        }
      }, 120_000);

      it('never returns a session twice while sessions move to the top between pages', async () => {
        const made = await sessions(250);
        const seen = await walk('recent', async (page) => {
          // Activity on sessions already returned — and on some not yet — moves
          // them above the cursor while the walk is under way.
          await Promise.all(
            made
              .filter((_, index) => index % 10 === page)
              .map((work, index) =>
                repository.appendEvents(work, [observed(`move-${page}-${index}`)]),
              ),
          );
        });
        expect(new Set(seen).size).toBe(seen.length);
      }, 120_000);

      it('still pages by number, with the count', async () => {
        await sessions(5);
        const first = await repository.findAllPaginated(scope(), { page: 1, limit: 2 });
        expect(first).toMatchObject({ total: 5, page: 1, limit: 2 });
        expect(first.data).toHaveLength(2);
        expect(first.nextCursor).not.toBeNull();
        const last = await repository.findAllPaginated(scope(), { page: 3, limit: 2 });
        expect(last.data).toHaveLength(1);
        expect(last.nextCursor).toBeNull();

        // A page's cursor carries on from where the page ended.
        const next = await repository.findAllPaginated(scope(), {
          page: 1,
          limit: 2,
          cursor: first.nextCursor ?? undefined,
        });
        const second = await repository.findAllPaginated(scope(), { page: 2, limit: 2 });
        expect(next.data.map((work) => work.id)).toEqual(second.data.map((work) => work.id));
      });
    });
  });

  describe('concurrency the row lock decides', () => {
    it('keeps resolved when a stop lands on a stale instance', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());

      // Two requests, two aggregates, both loaded before either wrote. Without
      // re-seating the fold from the locked row, the stop would fold onto its own
      // `open` copy and write the projection back over a terminal log.
      const closing = (await repository.findOneById(scope(), work.id)).unwrap();
      const stopping = (await repository.findOneById(scope(), work.id)).unwrap();

      await repository.appendEvents(closing, [
        { idempotencyKey: 'close:1', source: 'api', kind: SESSION_EVENT_KINDS.CLOSED, payload: {} },
      ]);
      await repository.appendEvents(stopping, [
        { idempotencyKey: 'stop:1', source: 'api', kind: SESSION_EVENT_KINDS.STOPPED, payload: {} },
      ]);

      const [row] = await dataSource.query(`SELECT "state" FROM "work_session" WHERE "id" = $1`, [
        work.id,
      ]);
      expect(row.state).toBe('resolved');
      // And the aggregate the caller is holding agrees, because it was re-seated.
      expect(stopping.state).toBe('resolved');
    });

    it('lets an archive and a create race to one winner, never both', async () => {
      // The archive locks the project row, asks the question inside that lock and
      // writes `archivedAt` before releasing it; the create takes a share lock on
      // the same row inside its insert transaction. Whichever waits sees the other's
      // committed work.
      const projects = new ProjectRepository(
        dataSource.getRepository(ProjectOrmEntity),
        new ProjectMapper(),
        outbox(),
      );
      const work = session();

      const [archive, create] = await Promise.allSettled([
        projects.archiveIfUnused(scope(), projectId, () =>
          repository.countUnresolvedForProject(scope(), projectId).then((open) => open > 0),
        ),
        repository.createIfUnclaimed(work, requested()),
      ]);

      expect(archive.status).toBe('fulfilled');
      expect(create.status).toBe('fulfilled');
      const archived = archive.status === 'fulfilled' && archive.value.result === 'archived';
      const inserted = create.status === 'fulfilled' && create.value.created;

      expect(archived).not.toBe(inserted);
      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int FROM "work_session" WHERE "projectId" = $1 AND "state" <> 'resolved'`,
        [projectId],
      );
      const [row] = await dataSource.query(`SELECT "archivedAt" FROM "project" WHERE "id" = $1`, [
        projectId,
      ]);
      // The invariant the pair exists to hold: never an archived project with
      // unresolved work in it.
      expect(row.archivedAt === null || count === 0).toBe(true);
    });

    it('moves a session’s listing, folded from the log, and nothing else', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());
      const target = await insertProject(organizationId, 'client-sites');

      const outcome = await repository.appendMove(work, target, [
        {
          idempotencyKey: `api:${randomUUID()}:${SESSION_EVENT_KINDS.MOVED}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.MOVED,
          payload: { from: projectId, to: target },
        },
      ]);

      expect(outcome).toBe('moved');
      const [row] = await dataSource.query(
        `SELECT "projectId", "slug" FROM "work_session" WHERE "id" = $1`,
        [work.id],
      );
      expect(row).toEqual({ projectId: target, slug: work.slug });
      // Counted where it is listed: the old project no longer holds it for archiving.
      expect(await repository.countUnresolvedForProject(scope(), projectId)).toBe(0);
      expect(await repository.countUnresolvedForProject(scope(), target)).toBe(1);
    });

    it('refuses a move into a project an archive retired first, and writes nothing', async () => {
      const work = session();
      await repository.createIfUnclaimed(work, requested());
      const target = await insertProject(organizationId, 'retired');
      await dataSource.query(`UPDATE "project" SET "archivedAt" = now() WHERE "id" = $1`, [target]);

      const outcome = await repository.appendMove(work, target, [
        {
          idempotencyKey: `api:${randomUUID()}:${SESSION_EVENT_KINDS.MOVED}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.MOVED,
          payload: { from: projectId, to: target },
        },
      ]);

      expect(outcome).toBe('project-archived');
      const [row] = await dataSource.query(
        `SELECT "projectId" FROM "work_session" WHERE "id" = $1`,
        [work.id],
      );
      expect(row.projectId).toBe(projectId);
      expect((await events(work.id)).map((event) => event.kind)).not.toContain(
        SESSION_EVENT_KINDS.MOVED,
      );
    });
  });

  describe('the owner role', () => {
    it('manages the sessions of the active workspace', async () => {
      const rule = SYSTEM_ROLE_PERMISSIONS.owner.find(
        (candidate) => candidate.subject === 'Session',
      );
      expect(rule).toBeDefined();
      const ownerRules = async () => {
        const [role] = await dataSource.query(
          `SELECT "permissions" FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL`,
        );
        return role.permissions as Record<string, unknown>[];
      };
      expect(await ownerRules()).toContainEqual(rule);
    });
  });
});
