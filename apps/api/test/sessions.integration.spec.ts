import { randomUUID } from 'node:crypto';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { AddSessionRolePermissions1789100100000 } from '../src/migrations/1789100100000-AddSessionRolePermissions';
import { ProjectOrmEntity } from '../src/projects/database/project.orm-entity';
import { ProjectRepository } from '../src/projects/database/project.repository';
import { ProjectMapper } from '../src/projects/project.mapper';
import { SessionCheckoutOrmEntity } from '../src/sessions/database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from '../src/sessions/database/work-session.orm-entity';
import { WorkSessionRepository } from '../src/sessions/database/work-session.repository';
import { WorkSessionEventOrmEntity } from '../src/sessions/database/work-session-event.orm-entity';
import { SessionCheckoutEntity } from '../src/sessions/domain/session-checkout.entity';
import { SESSION_EVENT_KINDS } from '../src/sessions/domain/session-state.policy';
import { WorkSessionEntity } from '../src/sessions/domain/work-session.entity';
import { WorkSessionMapper } from '../src/sessions/work-session.mapper';
import { runAllMigrations } from './run-migrations';

/**
 * The log, the fold and the composite keys, against a real Postgres.
 *
 * The unit tests prove the fold is pure and the handlers refuse what they should.
 * This is the layer that proves the **database** enforces what the design says it
 * does — that a foreign project is rejected by a constraint rather than by a check
 * somebody remembered, that `seq` stays dense under concurrent appends, and that
 * closing a session leaves the row where it was. Those are the failures no unit
 * test could catch, and each one is a bug that produces a second directory, a second
 * branch or a stranger's conversation state.
 *
 * The schema is built by running the **whole migration chain**, so a mistake in a
 * migration fails here rather than in production.
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

  /** The outbox is a real one; nothing here asserts on it, and a wake needs no queue. */
  const outbox = () =>
    ({
      stageEvents: async () => undefined,
      wake: async () => undefined,
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

    // The whole chain, in order. A session's composite keys reference tables three
    // migrations created, so this is also the test that they run together.
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
      ],
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

    projectId = await insertProject(organizationId, 'xrp-mobile', '4242');
    foreignProjectId = await insertProject(otherOrganizationId, 'xrp-mobile', '9999');
    installationId = await insertInstallation(organizationId, 1);
    foreignInstallationId = await insertInstallation(otherOrganizationId, 2);
  });

  async function insertProject(org: string, slug: string, origin: string): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "project" ("id", "organizationId", "name", "slug", "originGithubRepoId")
       VALUES ($1, $2, $3, $4, $5)`,
      [id, org, slug, slug, origin],
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
     * The fold's columns are the projection, so **every** one of them has to be
     * written where the fold runs.
     *
     * This is the test that would have caught a real bug: the update inside
     * `appendWithin` hand-listed its columns, so the four observation columns —
     * the inputs the sidebar's debounce reads — and later the three launch
     * options were folded onto the aggregate and never reached the row. Nothing
     * noticed, because every assertion read the aggregate rather than the row.
     * So this one reads the row.
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
            launch: { model: 'opus', permission: 'auto', effort: 'high' },
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
      expect(row.launchModel).toBe('opus');
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
        model: 'opus',
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

  describe('the composite keys', () => {
    it('rejects a session in another workspace’s project', async () => {
      // Not a handler check: the constraint makes it unrepresentable.
      const work = session();
      Object.assign(work as unknown as { props: Record<string, unknown> }, {});
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

      // Both attempts accept the key — `DO NOTHING` cannot tell a row it just wrote
      // from one a previous attempt wrote, and for the runner both mean "stop
      // resending this".
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
      // And the seq stays dense over what did land.
      expect((await events(work.id)).map((entry) => entry.seq)).toEqual([1, 2]);
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

      // The tombstone: the slug cannot be taken again inside this project, which is
      // what stops a new session inheriting a retired agent's conversation state.
      await expect(
        dataSource.query(
          `INSERT INTO "work_session"
             ("id", "organizationId", "projectId", "createdByUserId", "hostId", "name", "slug", "agent")
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'claude-code')`,
          [randomUUID(), organizationId, projectId, userId, hostId, 'x', 'bold-otter-abc123'],
        ),
      ).rejects.toThrow(/UQ_work_session_project_slug|duplicate key/i);
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

      // The event is what retires it: folding `session.checkout_removed` nulls the
      // column and marks the child, so the row and the log cannot disagree.
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

      // Exactly one of them won: either the project is archived and no session was
      // inserted, or the session exists and the archive refused.
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
  });

  describe('the role migration', () => {
    it('bumps every workspace’s roleVersion, and appends the rule only once', async () => {
      const rule = {
        action: 'manage',
        subject: 'Session',
        conditions: { organizationId: '${activeOrganizationId}' },
      };
      const ownerRules = async () => {
        const [role] = await dataSource.query(
          `SELECT "permissions" FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL`,
        );
        return role.permissions as Record<string, unknown>[];
      };
      const roleVersion = async () => {
        const [row] = await dataSource.query(
          `SELECT "roleVersion" FROM "organization" WHERE "id" = $1`,
          [organizationId],
        );
        return row.roleVersion as number;
      };

      expect(await ownerRules()).toContainEqual(rule);

      // Reverting and re-running is what proves `down()` removes exactly this rule
      // and that the version bump reaches workspaces that already exist. The
      // migration is driven directly rather than through `undoLastMigration`, which
      // would revert whatever migration happens to be last in the chain — and that
      // is a different one every time a slice lands.
      const migration = new AddSessionRolePermissions1789100100000();
      const runner = dataSource.createQueryRunner();
      await migration.down(runner);
      expect(await ownerRules()).not.toContainEqual(rule);
      const before = await roleVersion();

      await migration.up(runner);
      await runner.release();
      expect(await ownerRules()).toContainEqual(rule);
      expect(await roleVersion()).toBe(before + 1);
    });
  });
});
