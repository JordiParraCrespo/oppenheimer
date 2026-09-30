import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { Some } from 'oxide.ts';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, type EntityManager } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import type { InboundEventLookupPort } from '../../inbound-events/application/inbound-event-lookup.port';
import { AutomationLimitsResolver } from '../application/automation-limits.resolver';
import { AutomationMapper } from '../automation.mapper';
import { AutomationRunMapper } from '../automation-run.mapper';
import { FireDueSchedulesCommand } from '../commands/fire-due-schedules/fire-due-schedules.command';
import { FireDueSchedulesCommandHandler } from '../commands/fire-due-schedules/fire-due-schedules.command-handler';
import { FireEventTriggersCommand } from '../commands/fire-event-triggers/fire-event-triggers.command';
import { FireEventTriggersCommandHandler } from '../commands/fire-event-triggers/fire-event-triggers.command-handler';
import { AutomationOrmEntity } from '../database/automation.orm-entity';
import { AutomationRepository } from '../database/automation.repository';
import { AutomationRevisionOrmEntity } from '../database/automation-revision.orm-entity';
import { AutomationRunOrmEntity } from '../database/automation-run.orm-entity';
import { AutomationRunRepository } from '../database/automation-run.repository';
import { AutomationSettingsOrmEntity } from '../database/automation-settings.orm-entity';
import { AutomationSettingsRepository } from '../database/automation-settings.repository';
import { AutomationTriggerOrmEntity } from '../database/automation-trigger.orm-entity';
import { AutomationTriggerSubjectOrmEntity } from '../database/automation-trigger-subject.orm-entity';
import { AutomationEntity } from '../domain/automation.entity';
import type { AutomationTriggerProps } from '../domain/automation.types';
import { triggerFromInput } from '../domain/trigger-config.policy';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The unit tests prove each handler decides from what it is handed. This
 * suite, against a real Postgres, proves the **caps hold under concurrency**
 * — that a tick counts the runs it has just queued, that concurrent events
 * for one workspace serialise on its firing lock, and that a tick and a burst
 * of events together never fire past the workspace's hourly cap — and that the runs list,
 * scoped on the run itself, answers the right totals and counts.
 */
describe('automations: firing under the caps, and the runs list (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let automations: AutomationRepository;
  let runs: AutomationRunRepository;
  let settings: AutomationSettingsRepository;
  let tick: FireDueSchedulesCommandHandler;
  let events: FireEventTriggersCommandHandler;
  let organizationId: string;
  let otherOrganizationId: string;
  let projectId: string;
  let otherProjectId: string;
  let userId: string;
  let hostId: string;

  /**
   * No queue here: the outbox's transaction is the data source's own, a staged
   * dispatch inserts nothing, and there is no relay to wake.
   */
  const outbox = {
    transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
      dataSource.transaction(work),
    stageJob: async () => undefined,
    stageEvents: async () => undefined,
  } as unknown as OutboxService;

  const scope = (overrides: Partial<AccessScope> = {}): AccessScope =>
    ({
      userId,
      organizationId,
      teamIds: [],
      grants: new Map(),
      bypass: false,
      ...overrides,
    }) as AccessScope;

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
      entities: [
        AutomationOrmEntity,
        AutomationRevisionOrmEntity,
        AutomationTriggerOrmEntity,
        AutomationTriggerSubjectOrmEntity,
        AutomationRunOrmEntity,
        AutomationSettingsOrmEntity,
      ],
      synchronize: false,
    });
    await dataSource.initialize();

    const runMapper = new AutomationRunMapper();
    automations = new AutomationRepository(
      dataSource.getRepository(AutomationOrmEntity),
      dataSource,
      outbox,
      new AutomationMapper(runMapper),
      runMapper,
    );
    runs = new AutomationRunRepository(
      dataSource.getRepository(AutomationRunOrmEntity),
      dataSource,
      outbox,
      runMapper,
    );
    settings = new AutomationSettingsRepository(
      dataSource.getRepository(AutomationSettingsOrmEntity),
    );
    const limits = new AutomationLimitsResolver(settings, {
      get: () => undefined,
    } as unknown as ConfigService);
    tick = new FireDueSchedulesCommandHandler(automations, limits);
    const lookup = { findOne: async () => Some({}) } as unknown as InboundEventLookupPort;
    const eventViews = {
      eventViewOf: () => ({
        type: 'pr_opened',
        source: 'github',
        subjectRef: '101',
        subjectName: 'acme/atlas',
        actorLogin: 'octocat',
        attributes: {},
        context: {},
      }),
    } as unknown as AutomationRunMapper;
    events = new FireEventTriggersCommandHandler(automations, runs, lookup, limits, eventViews);
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
    projectId = await insertProject(organizationId, 'atlas');
    otherProjectId = await insertProject(otherOrganizationId, 'atlas');
  });

  async function insertProject(org: string, slug: string): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "project" ("id", "organizationId", "name", "slug") VALUES ($1, $2, $3, $4)`,
      [id, org, slug, slug],
    );
    return id;
  }

  function hourly(minute: number): AutomationTriggerProps {
    return triggerFromInput(
      { source: 'schedule', frequency: 'hourly', hour: 0, minute, timezone: 'UTC' },
      minute,
    );
  }

  function prOpened(): AutomationTriggerProps {
    return triggerFromInput(
      {
        source: 'github',
        event: 'pr_opened',
        repositories: [101],
        filter: { op: 'equals', value: 'main' },
      },
      0,
    );
  }

  async function createAutomation(
    triggers: AutomationTriggerProps[],
    overrides: { org?: string; project?: string; maxRunsPerHour?: number } = {},
  ): Promise<AutomationEntity> {
    const automation = AutomationEntity.createNew({
      organizationId: overrides.org ?? organizationId,
      projectId: overrides.project ?? projectId,
      ownerUserId: userId,
      name: `Automation ${randomUUID().slice(0, 6)}`,
      revision: {
        hostId,
        agent: 'claude-code',
        model: null,
        permission: 'auto',
        effort: null,
        prompt: 'Review it.',
        repositories: [
          { installationId: randomUUID(), githubRepoId: '101', fullName: 'acme/atlas' },
        ],
        createdByUserId: userId,
      },
      triggers,
      active: true,
      maxRunsPerHour: overrides.maxRunsPerHour ?? null,
      now: new Date(),
    });
    await automations.insert(automation);
    return automation;
  }

  /** Every schedule trigger of the workspace reached its slot a minute ago. */
  async function makeDue(org = organizationId): Promise<void> {
    await dataSource.query(
      `UPDATE "automation_trigger" SET "nextFireAt" = now() - interval '1 minute'
        WHERE "organizationId" = $1 AND "source" = 'schedule'`,
      [org],
    );
  }

  async function outcomes(org = organizationId) {
    const rows: { outcome: string; skipReason: string | null; count: string }[] =
      await dataSource.query(
        `SELECT "outcome", "skipReason", count(*) AS "count" FROM "automation_run"
          WHERE "organizationId" = $1 GROUP BY 1, 2`,
        [org],
      );
    return Object.fromEntries(
      rows.map((row) => [`${row.outcome}:${row.skipReason ?? ''}`, Number(row.count)]),
    );
  }

  async function storedEvent(externalId: string): Promise<string> {
    const [row]: { id: string }[] = await dataSource.query(
      `INSERT INTO "inbound_event"
         ("organizationId", "source", "externalId", "eventType", "subjectKind", "subjectRef", "occurredAt")
       VALUES ($1, 'github', $2, 'pr_opened', 'repository', '101', now()) RETURNING "id"`,
      [organizationId, externalId],
    );
    return row.id;
  }

  async function fireEvent(externalId: string): Promise<number> {
    return events.execute(
      new FireEventTriggersCommand({
        organizationId,
        inboundEventId: await storedEvent(externalId),
        source: 'github',
        eventType: 'pr_opened',
        subjectRef: '101',
        externalId,
        actorIsOwnApp: false,
        attributes: { baseBranch: 'main' },
      }),
    );
  }

  /** A run with the given outcome, and — for a dispatched one — its session and first turn. */
  async function run(
    automation: AutomationEntity,
    daysAgo: number,
    outcome: 'pending' | 'skipped' | 'expired' | 'dispatched',
    session: { state?: string; turn?: string } = {},
  ): Promise<void> {
    const createdAt = new Date(Date.now() - daysAgo * DAY);
    let sessionId: string | null = null;
    if (outcome === 'dispatched') {
      sessionId = randomUUID();
      await dataSource.query(
        `INSERT INTO "work_session"
           ("id", "organizationId", "projectId", "createdByUserId", "hostId", "name", "slug",
            "agent", "state")
         VALUES ($1, $2, $3, $4, $5, 'run', $6, 'claude-code', $7)`,
        [
          sessionId,
          automation.organizationId,
          automation.projectId,
          userId,
          hostId,
          `run-${sessionId.slice(0, 8)}`,
          session.state ?? 'open',
        ],
      );
      if (session.turn) {
        await dataSource.query(
          `INSERT INTO "session_turn" ("organizationId", "sessionId", "seq", "origin", "state")
           VALUES ($1, $2, 1, 'automation', $3)`,
          [automation.organizationId, sessionId, session.turn],
        );
      }
    }
    await dataSource.query(
      `INSERT INTO "automation_run"
         ("organizationId", "automationId", "revisionId", "cause", "causeKey", "outcome",
          "skipReason", "sessionId", "dispatchedAt", "createdAt")
       VALUES ($1, $2, $3, 'manual', $4, $5, $6, $7, $8, $9)`,
      [
        automation.organizationId,
        automation.id,
        automation.revision.id,
        randomUUID(),
        outcome,
        outcome === 'skipped' ? 'workspace_rate_limited' : null,
        sessionId,
        outcome === 'dispatched' ? createdAt : null,
        createdAt,
      ],
    );
  }

  /** One run of every status, `daysAgo`: queued ×2 (pending, a queued turn), then one each. */
  async function everyStatus(automation: AutomationEntity, daysAgo: number): Promise<void> {
    await run(automation, daysAgo, 'pending');
    await run(automation, daysAgo, 'dispatched', { turn: 'queued' });
    await run(automation, daysAgo, 'dispatched', { state: 'open' });
    await run(automation, daysAgo, 'dispatched', { turn: 'in_progress' });
    await run(automation, daysAgo, 'dispatched', { state: 'resolved' });
    await run(automation, daysAgo, 'dispatched', { turn: 'failed' });
    await run(automation, daysAgo, 'dispatched', { turn: 'cancelled' });
    await run(automation, daysAgo, 'skipped');
    await run(automation, daysAgo, 'expired');
  }

  describe('the tick', () => {
    it('does not fire past the workspace cap: the batch counts the runs it queued', async () => {
      await settings.upsert(organizationId, { maxRunsPerWorkspaceHour: 3 });
      for (let i = 0; i < 5; i += 1) await createAutomation([hourly(0)]);
      await makeDue();
      expect(await tick.execute(new FireDueSchedulesCommand({ now: new Date() }))).toBe(3);
      expect(await outcomes()).toEqual({ 'pending:': 3, 'skipped:workspace_rate_limited': 2 });
    });

    it('does not fire one automation past its own cap in one batch', async () => {
      await createAutomation([hourly(0), hourly(10), hourly(20)], { maxRunsPerHour: 2 });
      await makeDue();
      expect(await tick.execute(new FireDueSchedulesCommand({ now: new Date() }))).toBe(2);
      expect(await outcomes()).toEqual({ 'pending:': 2, 'skipped:automation_rate_limited': 1 });
    });
  });

  describe('event firing', () => {
    it('does not overshoot the cap under concurrent events', async () => {
      await settings.upsert(organizationId, { maxRunsPerWorkspaceHour: 3 });
      for (let i = 0; i < 6; i += 1) await createAutomation([prOpened()]);
      const queued = await Promise.all(
        Array.from({ length: 6 }, (_, i) => fireEvent(`delivery-${i}-${randomUUID()}`)),
      );
      expect(queued.reduce((sum, count) => sum + count, 0)).toBe(3);
      expect(await outcomes()).toEqual({ 'pending:': 3, 'skipped:workspace_rate_limited': 33 });
    });

    it('a tick and a burst of events together never exceed the workspace cap', async () => {
      await settings.upsert(organizationId, { maxRunsPerWorkspaceHour: 4 });
      for (let i = 0; i < 3; i += 1) await createAutomation([hourly(0)]);
      for (let i = 0; i < 3; i += 1) await createAutomation([prOpened()]);
      await makeDue();
      await Promise.all([
        tick.execute(new FireDueSchedulesCommand({ now: new Date() })),
        ...Array.from({ length: 4 }, (_, i) => fireEvent(`burst-${i}-${randomUUID()}`)),
      ]);
      const counted = await outcomes();
      expect(counted['pending:']).toBe(4);
      expect(counted['skipped:workspace_rate_limited']).toBe(3 + 4 * 3 - 4);
    });
  });

  describe('the runs list', () => {
    it('answers the same page, total and counts, bounded by the window and the workspace', async () => {
      const first = await createAutomation([hourly(0)]);
      const secondProjectId = await insertProject(organizationId, 'mobile');
      const second = await createAutomation([hourly(0)], { project: secondProjectId });
      const foreign = await createAutomation([hourly(0)], {
        org: otherOrganizationId,
        project: otherProjectId,
      });
      await everyStatus(first, 1);
      await everyStatus(first, 20);
      await everyStatus(first, 35); // outside the window
      await everyStatus(second, 2);
      await everyStatus(foreign, 1); // another workspace
      const since = new Date(Date.now() - 30 * DAY);
      // Per automation in the window: queued 2, running 2, completed 1, failed 1,
      // cancelled 1, skipped 1, expired 1.
      const listed = await runs.page(scope(), { since }, 1, 10);
      expect(listed.total).toBe(3 * 7);
      expect(listed.items).toHaveLength(10);
      expect(listed.counts).toEqual({ all: 21, completed: 3, failed: 3, running: 12 });
      const last = await runs.page(scope(), { since }, 3, 10);
      expect(last.items).toHaveLength(1);

      const skipped = await runs.page(scope(), { since, statuses: ['skipped'] }, 1, 10);
      expect(skipped.total).toBe(3);
      expect(skipped.items.every((item) => item.status === 'skipped')).toBe(true);
      expect(skipped.counts.all).toBe(21);

      const byAutomation = await runs.page(scope(), { since, automationId: first.id }, 1, 10);
      expect(byAutomation.total).toBe(14);
      expect(byAutomation.counts).toEqual({ all: 14, completed: 2, failed: 2, running: 8 });

      const byProject = await runs.page(scope(), { since, projectId: secondProjectId }, 1, 10);
      expect(byProject.total).toBe(7);
      expect(byProject.items.every((item) => item.automationId === second.id)).toBe(true);
    });

    it('a bypass scope reaches every workspace, and a scope with none reaches nothing', async () => {
      const mine = await createAutomation([hourly(0)]);
      const foreign = await createAutomation([hourly(0)], {
        org: otherOrganizationId,
        project: otherProjectId,
      });
      await run(mine, 1, 'pending');
      await run(foreign, 1, 'pending');
      const since = new Date(Date.now() - DAY - HOUR);
      const everyone = await runs.page(
        scope({ bypass: true, organizationId: null }),
        { since, statuses: ['queued'] },
        1,
        100,
      );
      const ids = everyone.items.map((item) => item.automationId);
      expect(ids).toEqual(expect.arrayContaining([mine.id, foreign.id]));
      const nobody = await runs.page(scope({ organizationId: null }), { since }, 1, 10);
      expect(nobody.total).toBe(0);
      expect(nobody.items).toEqual([]);
    });
  });

  describe('the run-limit sweep', () => {
    it('a zombie run no longer blocks the sweep', async () => {
      const automation = await createAutomation([hourly(0)]);
      const zombies = 250;
      await dataSource.query(
        `WITH sessions AS (
           INSERT INTO "work_session"
             ("organizationId", "projectId", "createdByUserId", "hostId", "name", "slug", "agent", "state")
           SELECT $1, $2, $3, $4, 'zombie', 'zombie-' || n, 'claude-code', 'open'
             FROM generate_series(1, $6::int) AS n
           RETURNING "id"
         )
         INSERT INTO "automation_run"
           ("organizationId", "automationId", "revisionId", "cause", "causeKey", "outcome",
            "sessionId", "dispatchedAt", "createdAt")
         SELECT $1, $5, $7, 'manual', gen_random_uuid()::text, 'dispatched', "id",
                now() - interval '10 hours', now() - interval '10 hours'
           FROM sessions`,
        [organizationId, projectId, userId, hostId, automation.id, zombies, automation.revision.id],
      );
      await run(automation, 2 / 24, 'dispatched', { state: 'open' });
      const now = Date.now();
      const live = await runs.findLiveDispatchedBefore(
        new Date(now - 60_000),
        new Date(now - 7 * HOUR),
        200,
      );
      const mine = live.filter((candidate) => candidate.automationId === automation.id);
      expect(mine).toHaveLength(1);
      expect(now - mine[0].dispatchedAt.getTime()).toBeLessThan(3 * HOUR);
    });
  });

  describe('project archive', () => {
    it("finds only the workspace's automations in that project", async () => {
      const automation = await createAutomation([hourly(0)]);
      const found = await automations.findLiveInProjectForSystem(organizationId, projectId);
      expect(found.map((candidate) => candidate.id)).toEqual([automation.id]);
      expect(await automations.findLiveInProjectForSystem(otherOrganizationId, projectId)).toEqual(
        [],
      );
    });
  });
});
