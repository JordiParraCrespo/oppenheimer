import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource, type EntityManager } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { SessionCheckoutOrmEntity } from '../database/session-checkout.orm-entity';
import { SessionCloudRunOrmEntity } from '../database/session-cloud-run.orm-entity';
import { WorkSessionOrmEntity } from '../database/work-session.orm-entity';
import { WorkSessionRepository } from '../database/work-session.repository';
import type { NewSessionEvent } from '../database/work-session.repository.port';
import { WorkSessionEventOrmEntity } from '../database/work-session-event.orm-entity';
import { SESSION_NAME_HIT, SESSION_SEARCH_KINDS } from '../domain/session-search.policy';
import { mintSessionSlug } from '../domain/session-slug.policy';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * `search_sessions`' search against a real Postgres (`AddSessionSearch`):
 * the words of a session's name and log are found, its ids, hashes and
 * senders are not; web-search syntax works; each session comes back with at
 * most its two best hits, sessions best first and the latest on a tie; the
 * filters narrow; a closed session is found; a session of another workspace
 * never is; and the repository's predicates can be served by both GIN
 * indexes, which only holds while they repeat the indexes' expressions and
 * predicate exactly.
 * The schema is the migrations'. How a hit is said to the bot is
 * `bot-host-tools.factory.spec.ts`.
 */
describe('sessions: searching names and logs (integration)', () => {
  let dataSource: DataSource;
  let repository: WorkSessionRepository;
  let organizationId: string;
  let otherOrganizationId: string;
  let projectId: string;
  let otherProjectId: string;
  let hostId: string;
  let otherHostId: string;
  let userId: string;

  const scopeOf = (org: string): AccessScope => ({
    userId,
    organizationId: org,
    teamIds: [],
    grants: new Map<string, Set<string>>(),
    bypass: false,
  });
  const scope = () => scopeOf(organizationId);

  const outbox = () =>
    ({
      transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
        dataSource.transaction(work),
      stageEvents: async () => undefined,
    }) as unknown as OutboxService;

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        WorkSessionOrmEntity,
        SessionCheckoutOrmEntity,
        WorkSessionEventOrmEntity,
        SessionCloudRunOrmEntity,
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
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    otherOrganizationId = randomUUID();
    userId = randomUUID();
    hostId = randomUUID();
    otherHostId = randomUUID();
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
    for (const [id, name] of [
      [hostId, 'devbox'],
      [otherHostId, 'laptop'],
    ] as const) {
      await dataSource.query(
        `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
         VALUES ($1, $2, $3, $4, $5)`,
        [id, userId, name, 'key', randomUUID()],
      );
    }
    projectId = await insertProject(organizationId, 'website');
    otherProjectId = await insertProject(organizationId, 'mobile');
  });

  async function insertProject(org: string, slug: string): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "project" ("id", "organizationId", "name", "slug") VALUES ($1, $2, $3, $4)`,
      [id, org, slug, slug],
    );
    return id;
  }

  /** A session with its first task, on the host and in the project asked for. */
  async function started(
    task: string,
    options: { org?: string; project?: string; host?: string; at?: Date } = {},
  ): Promise<WorkSessionEntity> {
    const work = WorkSessionEntity.request({
      organizationId: options.org ?? organizationId,
      projectId: options.project ?? projectId,
      createdByUserId: userId,
      hostId: options.host ?? hostId,
      slug: mintSessionSlug(),
      agent: 'claude-code',
    });
    await repository.createIfUnclaimed(work, [
      entry(SESSION_EVENT_KINDS.REQUESTED, { agent: 'claude-code' }),
      entry(SESSION_EVENT_KINDS.PROMPT_FIRST, { text: task }, options.at),
    ]);
    return work;
  }

  function entry(kind: string, payload: unknown, occurredAt?: Date): NewSessionEvent {
    return {
      idempotencyKey: `${kind}:${randomUUID()}`,
      source: 'api',
      kind,
      payload,
      ...(occurredAt ? { occurredAt } : {}),
    };
  }

  const search = (query: string, extra: Partial<Parameters<typeof repository.search>[1]> = {}) =>
    repository.search(scope(), { query, limit: 10, ...extra });

  it('finds the words of each kind of entry it reads, and never an id, a hash or a sender', async () => {
    const work = await started('Fix the flaky login redirect');
    const botId = randomUUID();
    await repository.appendEvents(work, [
      entry(SESSION_EVENT_KINDS.PROMPT_SENT, {
        text: 'Also check the cookie domain',
        sender: { kind: 'bot', botId, turnId: randomUUID() },
      }),
      entry('turn.ended', { exitCode: 0, result: 'Patched the SameSite attribute' }),
      entry('agent.decision', {
        decision: {
          kind: 'question',
          id: 'toolu_01quokka',
          questions: [
            {
              header: 'Store',
              question: 'Which session store?',
              multiSelect: false,
              options: [
                { label: 'Redis', description: 'shared across replicas' },
                { label: 'Memory', description: null },
              ],
            },
          ],
        },
      }),
      entry('agent.notified', { id: randomUUID(), text: 'Opened a draft pull request' }),
      entry('file.shared', {
        id: randomUUID(),
        name: 'trace.png',
        mediaType: 'image/png',
        size: 10,
        caption: 'Waterfall of the redirect',
        hasPreview: true,
      }),
      entry(SESSION_EVENT_KINDS.FAILED, { code: 'RUNNER_001', detail: 'tmux exited early' }),
      entry(SESSION_EVENT_KINDS.REPORT_PUBLISHED, { hash: 'deadbeefcafe' }),
    ]);

    for (const [words, kind] of [
      ['flaky login', SESSION_EVENT_KINDS.PROMPT_FIRST],
      ['cookie domain', SESSION_EVENT_KINDS.PROMPT_SENT],
      ['SameSite', 'turn.ended'],
      ['session store', 'agent.decision'],
      ['replicas', 'agent.decision'],
      ['draft pull request', 'agent.notified'],
      ['waterfall', 'file.shared'],
      ['tmux', SESSION_EVENT_KINDS.FAILED],
    ] as const) {
      const [match, ...rest] = await search(words);
      expect(rest).toEqual([]);
      expect(match.session.id).toBe(work.id);
      expect(match.hits[0].kind).toBe(kind);
      expect(match.hits[0].text.toLowerCase()).toContain(words.split(' ')[0].toLowerCase());
    }
    for (const id of [botId, 'toolu_01quokka', 'deadbeefcafe', 'RUNNER_001', work.id, 'bot']) {
      expect(await search(id)).toEqual([]);
    }
  });

  it('finds a session by its name, and reads web-search syntax as typed', async () => {
    const work = await started('Upgrade the payment SDK');
    await repository.appendEvents(work, [
      entry(SESSION_EVENT_KINDS.NAMED, { name: 'Stripe upgrade', source: 'user' }),
    ]);

    const [byName] = await search('stripe');
    expect(byName.session.id).toBe(work.id);
    expect(byName.hits.map((hit) => hit.kind)).toContain(SESSION_NAME_HIT);
    expect(await search('"payment SDK"')).toHaveLength(1);
    expect(await search('"SDK payment"')).toEqual([]);
    // An exclusion holds per entry: the task names the SDK, and no other
    // entry says "payment".
    expect(await search('payment -SDK')).toEqual([]);
    expect(await search('nothing OR payment')).toHaveLength(1);
    // A stray quote is not a syntax error.
    expect(await search('payment "unclosed')).toHaveLength(1);
  });

  it('keeps each session to its two best hits, sessions best first and the latest on a tie', async () => {
    const chatty = await started('deploy staging', { at: new Date('2026-11-01T09:00:00Z') });
    await repository.appendEvents(
      chatty,
      [1, 2, 3, 4, 5].map((n) =>
        entry(
          SESSION_EVENT_KINDS.PROMPT_SENT,
          { text: `deploy staging again, attempt ${n}` },
          new Date(`2026-11-01T1${n}:00:00Z`),
        ),
      ),
    );
    const older = await started('deploy staging', { at: new Date('2026-10-01T09:00:00Z') });
    const newer = await started('deploy staging', { at: new Date('2026-10-20T09:00:00Z') });

    const matches = await search('deploy staging');
    expect(matches.map((match) => match.session.id)).toContain(chatty.id);
    expect(matches.every((match) => match.hits.length <= 2)).toBe(true);
    expect(matches.find((match) => match.session.id === chatty.id)?.hits).toHaveLength(2);
    // Equal ranks: the newer of the two quiet sessions comes first.
    const ids = matches.map((match) => match.session.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));

    const page = await search('deploy staging', { limit: 1 });
    expect(page).toHaveLength(1);
  });

  it('narrows by host, project and time, and finds a closed session', async () => {
    const here = await started('rotate the TLS certificate', {
      at: new Date('2026-11-05T09:00:00Z'),
    });
    const there = await started('rotate the TLS certificate', {
      host: otherHostId,
      project: otherProjectId,
      at: new Date('2026-10-01T09:00:00Z'),
    });
    await repository.appendEvents(there, [entry(SESSION_EVENT_KINDS.CLOSED, {})]);
    const [{ state }] = await dataSource.query(`SELECT state FROM work_session WHERE id = $1`, [
      there.id,
    ]);
    expect(state).toBe('resolved');

    const ids = async (extra: Partial<Parameters<typeof repository.search>[1]>) =>
      (await search('TLS certificate', extra)).map((match) => match.session.id).sort();
    expect(await ids({})).toEqual([here.id, there.id].sort());
    expect(await ids({ hostId: otherHostId })).toEqual([there.id]);
    expect(await ids({ projectId })).toEqual([here.id]);
    expect(await ids({ since: new Date('2026-11-01T00:00:00Z') })).toEqual([here.id]);
  });

  it('never finds a session of another workspace', async () => {
    const foreignProject = await insertProject(otherOrganizationId, 'theirs');
    await started('secret migration plan', { org: otherOrganizationId, project: foreignProject });

    expect(await search('secret migration')).toEqual([]);
    expect(
      await repository.search(scopeOf(otherOrganizationId), {
        query: 'secret migration',
        limit: 10,
      }),
    ).toHaveLength(1);
  });

  it('can serve both searches from their GIN indexes, written as the repository writes them', async () => {
    await started('index check');
    // The repository's predicates, alone: an index whose expression or
    // predicate the query does not repeat exactly is never chosen, even with
    // a sequential scan priced out.
    const kinds = SESSION_SEARCH_KINDS.map((kind) => `'${kind}'`).join(', ');
    const planOf = (sql: string) =>
      dataSource.transaction(async (manager) => {
        await manager.query('SET LOCAL enable_seqscan = off');
        const rows: { 'QUERY PLAN': string }[] = await manager.query(`EXPLAIN ${sql}`);
        return rows.map((row) => row['QUERY PLAN']).join('\n');
      });

    expect(
      await planOf(
        `SELECT e."sessionId" FROM "work_session_event" e
          WHERE e."kind" IN (${kinds})
            AND work_session_event_search_vector(e."kind", e."payload")
                @@ websearch_to_tsquery('simple', 'index check')`,
      ),
    ).toContain('IDX_work_session_event_search');
    expect(
      await planOf(
        `SELECT s."id" FROM "work_session" s
          WHERE to_tsvector('simple', s."name") @@ websearch_to_tsquery('simple', 'index check')`,
      ),
    ).toContain('IDX_work_session_name_search');
  });
});
