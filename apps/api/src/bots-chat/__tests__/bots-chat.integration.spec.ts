import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import type { ChatgptCredentialResolver } from '../../bots/application/chatgpt-credential.resolver';
import { TurnCredentialsResolver } from '../../bots/application/turn-credentials.resolver';
import { BotMapper } from '../../bots/bot.mapper';
import { BotDocumentMapper } from '../../bots/bot-document.mapper';
import { BotMemoryFactMapper } from '../../bots/bot-memory-fact.mapper';
import { BotOrmEntity } from '../../bots/database/bot.orm-entity';
import { BotRepository } from '../../bots/database/bot.repository';
import { BotDocumentOrmEntity } from '../../bots/database/bot-document.orm-entity';
import { BotDocumentRepository } from '../../bots/database/bot-document.repository';
import { BotDocumentRevisionOrmEntity } from '../../bots/database/bot-document-revision.orm-entity';
import { BotMemoryFactOrmEntity } from '../../bots/database/bot-memory-fact.orm-entity';
import { BotMemoryFactRepository } from '../../bots/database/bot-memory-fact.repository';
import { ModelProviderCredentialOrmEntity } from '../../bots/database/model-provider-credential.orm-entity';
import { ModelProviderCredentialRepository } from '../../bots/database/model-provider-credential.repository';
import { BotEntity } from '../../bots/domain/bot.entity';
import { userActor } from '../../bots/domain/bot.types';
import { BotDocumentEntity } from '../../bots/domain/bot-document.entity';
import { BotMemoryFactEntity } from '../../bots/domain/bot-memory-fact.entity';
import { ModelProviderCredentialEntity } from '../../bots/domain/model-provider-credential.entity';
import type { ProviderKeySealerPort } from '../../bots/infrastructure/provider-key-sealer.port';
import { ModelProviderCredentialMapper } from '../../bots/model-provider-credential.mapper';
import type { BotApprovalRequestFactory } from '../application/bot-approval-request.factory';
import { BotModelAccessResolver } from '../application/bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../application/bot-owner-scope.resolver';
import type { BotToolboxFactory } from '../application/bot-toolbox.factory';
import { BotTurnContextResolver } from '../application/bot-turn-context.resolver';
import { BotApprovalMapper } from '../bot-approval.mapper';
import { BotConversationSummaryMapper } from '../bot-conversation-summary.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import { BotApprovalOrmEntity } from '../database/bot-approval.orm-entity';
import { BotApprovalRepository } from '../database/bot-approval.repository';
import { BotConversationRepository } from '../database/bot-conversation.repository';
import { BotConversationSummaryOrmEntity } from '../database/bot-conversation-summary.orm-entity';
import { BotConversationSummaryRepository } from '../database/bot-conversation-summary.repository';
import { BotMessageOrmEntity } from '../database/bot-message.orm-entity';
import { BotMessageRepository } from '../database/bot-message.repository';
import { BotTurnOrmEntity } from '../database/bot-turn.orm-entity';
import { BotTurnRepository } from '../database/bot-turn.repository';
import { BotApprovalEntity } from '../domain/bot-approval.entity';
import { BotConversationSummaryEntity } from '../domain/bot-conversation-summary.entity';
import { BotMessageEntity } from '../domain/bot-message.entity';
import {
  routineActivityLine,
  routinePrefix,
  routineSourceKey,
  routineTurn,
} from '../domain/bot-routine.policy';
import { planSummary, type SummarizableMessage } from '../domain/bot-summary.policy';
import { BotTurnEntity } from '../domain/bot-turn.entity';
import type { OwnerHostsPort } from '../infrastructure/owner-hosts.port';

/**
 * A bot's chat against a real Postgres (`product/versions/mvp/25-bots.md`
 * §2–3): one running turn per bot and the next staged when it ends, a send
 * racing the end of a turn, the failure a turn's column holds, the stored
 * conversation and history, Stop's conditional writes, the cascade from the
 * bot, and a turn's context read in its own workspace only; Needs input
 * cards: one waiting per bot, decided once however many decide at once, the
 * event that opens a decision's turn, and the cascade; a conversation's
 * summary: one write of two racing ones wins, the cutoff never moves back,
 * and a turn's history and the summarizer's read start after it to the
 * microsecond. The schema is the migrations'.
 */
describe('bots chat (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let bots: BotRepository;
  let documents: BotDocumentRepository;
  let memory: BotMemoryFactRepository;
  let credentials: ModelProviderCredentialRepository;
  let turns: BotTurnRepository;
  let messages: BotMessageRepository;
  let approvals: BotApprovalRepository;
  let summaries: BotConversationSummaryRepository;
  let organizationId: string;
  let userId: string;

  const scopeOf = (organization: string): AccessScope => ({
    userId,
    organizationId: organization,
    teamIds: [],
    grants: new Map(),
    bypass: false,
  });
  const scope = () => scopeOf(organizationId);

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    process.env.DB_HOST = pg.getHost();
    process.env.DB_PORT = pg.getMappedPort(5432).toString();
    await runAllMigrations();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [
        BotOrmEntity,
        BotDocumentOrmEntity,
        BotDocumentRevisionOrmEntity,
        BotMemoryFactOrmEntity,
        ModelProviderCredentialOrmEntity,
        BotTurnOrmEntity,
        BotMessageOrmEntity,
        BotApprovalOrmEntity,
        BotConversationSummaryOrmEntity,
        OutboxMessageSchema,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    const documentMapper = new BotDocumentMapper();
    bots = new BotRepository(
      dataSource.getRepository(BotOrmEntity),
      dataSource,
      new BotMapper(),
      documentMapper,
    );
    documents = new BotDocumentRepository(
      dataSource.getRepository(BotDocumentOrmEntity),
      dataSource.getRepository(BotDocumentRevisionOrmEntity),
      dataSource,
      documentMapper,
    );
    memory = new BotMemoryFactRepository(
      dataSource.getRepository(BotMemoryFactOrmEntity),
      dataSource,
      new BotMemoryFactMapper(),
    );
    credentials = new ModelProviderCredentialRepository(
      dataSource.getRepository(ModelProviderCredentialOrmEntity),
      new ModelProviderCredentialMapper(),
    );
    turns = new BotTurnRepository(
      dataSource.getRepository(BotTurnOrmEntity),
      new OutboxService(dataSource),
      new BotTurnMapper(),
      new BotMessageMapper(),
      new BotConversationRepository(),
    );
    messages = new BotMessageRepository(
      dataSource.getRepository(BotMessageOrmEntity),
      dataSource,
      new BotMessageMapper(),
    );
    approvals = new BotApprovalRepository(
      dataSource.getRepository(BotApprovalOrmEntity),
      new BotApprovalMapper(),
      new OutboxService(dataSource),
      new BotTurnMapper(),
      new BotMessageMapper(),
    );
    summaries = new BotConversationSummaryRepository(
      dataSource.getRepository(BotConversationSummaryOrmEntity),
      new OutboxService(dataSource),
      new BotConversationSummaryMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
  });

  beforeEach(async () => {
    organizationId = await insertOrganization();
    userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [userId, `${userId}@example.com`],
    );
  });

  async function insertOrganization(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [id, `acme-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function create(name: string, options: { organization?: string } = {}): Promise<BotEntity> {
    const bot = BotEntity.createNew({
      organizationId: options.organization ?? organizationId,
      createdByUserId: userId,
      name,
      description: '',
      avatarColor: 'mint',
      groupId: null,
      homeHostId: null,
      provider: 'anthropic',
    });
    const docs = (['soul', 'instructions'] as const).map((documentName) =>
      BotDocumentEntity.initial({
        organizationId: bot.organizationId,
        botId: bot.id,
        name: documentName,
        content: documentName === 'soul' ? `You are ${name}.` : '',
        actor: userActor(userId),
      }),
    );
    expect(await bots.insert(bot, docs)).toBe('saved');
    return bot;
  }

  function credential(key: string, organization = organizationId) {
    return ModelProviderCredentialEntity.createNew({
      organizationId: organization,
      provider: 'glm',
      sealedKey: Buffer.from(`sealed:${key}`),
      keyHint: key.slice(-4),
      updatedByUserId: userId,
    });
  }

  function sent(bot: BotEntity, content: string) {
    const turn = BotTurnEntity.queue({
      organizationId: bot.organizationId,
      botId: bot.id,
      requestedByUserId: userId,
      provider: 'glm',
      model: 'glm-5.3',
      effort: null,
    });
    const message = BotMessageEntity.createNew({
      organizationId: bot.organizationId,
      botId: bot.id,
      turnId: turn.id,
      role: 'user',
      content,
      steps: [],
      position: 0,
    });
    return { turn, message };
  }

  async function stagedTurns(): Promise<string[]> {
    const rows: { payload: { turnId: string } }[] = await dataSource.query(
      `SELECT payload FROM outbox_message WHERE topic = 'bot-turns' ORDER BY "createdAt", id`,
    );
    return rows.map((row) => row.payload.turnId);
  }

  it('runs one turn per bot: the first is staged, the next waits and is staged when it ends', async () => {
    await dataSource.query(`DELETE FROM outbox_message`);
    const bot = await create('Glm Bot');
    const first = sent(bot, 'One');
    const second = sent(bot, 'Two');
    expect(await turns.enqueue(first.turn, first.message, null)).toBe('staged');
    expect(await turns.enqueue(second.turn, second.message, null)).toBe('waiting');
    expect(await stagedTurns()).toEqual([first.turn.id]);

    const claimed = (await turns.findForRun(first.turn.id)).unwrap();
    claimed.start(new Date());
    expect(await turns.claim(claimed)).toBe('claimed');
    // The second cannot start while the first runs, whatever claims it.
    const early = (await turns.findForRun(second.turn.id)).unwrap();
    early.start(new Date());
    expect(await turns.claim(early)).toBe('busy');

    claimed.end('completed', new Date(), { inputTokens: 5, outputTokens: 1 });
    expect(await turns.finish(claimed, null)).toBe(true);
    expect(await stagedTurns()).toEqual([first.turn.id, second.turn.id]);
    // A second write of the same ending loses: it was conditioned on running.
    const stale = BotTurnEntity.create({
      id: claimed.id,
      props: { ...claimed.getProps(), status: 'running' },
    });
    stale.end('failed', new Date());
    expect(await turns.finish(stale, null)).toBe(false);
  });

  it("queues a routine's run once, however often it is dispatched, and finds it live by its routine", async () => {
    await dataSource.query(`DELETE FROM outbox_message`);
    const bot = await create('Routine Bot');
    const firing = {
      automationId: '6a1c4f9e-0000-4000-8000-000000000001',
      runId: '6a1c4f9e-0000-4000-8000-000000000002',
      name: 'Morning PR digest',
      instructions: 'List the open pull requests.',
    };
    const props = {
      organizationId: bot.organizationId,
      botId: bot.id,
      requestedByUserId: userId,
      provider: 'glm' as const,
      model: 'glm-5.3',
      effort: null,
    };
    const first = routineTurn(props, firing);
    const again = routineTurn(props, firing);
    const busy = routinePrefix(firing.automationId);
    expect(await turns.enqueueOnce(first.turn, first.opening, null, busy)).toEqual({
      outcome: 'staged',
      turnId: first.turn.id,
    });
    // The same run dispatched again (a retried job) finds the turn it queued,
    // rather than reading its own turn as the routine being busy.
    expect(await turns.enqueueOnce(again.turn, again.opening, null, busy)).toEqual({
      outcome: 'existing',
      turnId: first.turn.id,
    });
    // The routine's next run, while that turn is live, queues nothing.
    const next = routineTurn(props, { ...firing, runId: '6a1c4f9e-0000-4000-8000-000000000003' });
    expect(await turns.enqueueOnce(next.turn, next.opening, null, busy)).toEqual({
      outcome: 'busy',
      turnId: next.turn.id,
    });
    // Another routine of the bot is not held by it; it waits its turn in the queue.
    const other = routineTurn(props, {
      ...firing,
      automationId: '6a1c4f9e-0000-4000-8000-000000000004',
    });
    expect(
      await turns.enqueueOnce(
        other.turn,
        other.opening,
        null,
        routinePrefix('6a1c4f9e-0000-4000-8000-000000000004'),
      ),
    ).toEqual({ outcome: 'waiting', turnId: other.turn.id });
    expect(await stagedTurns()).toEqual([first.turn.id]);

    const stored = (await turns.findForRun(first.turn.id)).unwrap();
    expect(stored).toMatchObject({
      origin: 'routine',
      sourceKey: routineSourceKey(firing.automationId, firing.runId),
    });
    const [opening] = await dataSource.query(
      `SELECT role, event FROM bot_message WHERE "turnId" = $1`,
      [first.turn.id],
    );
    expect(opening).toEqual({
      role: 'event',
      event: {
        kind: 'routine',
        activity: 'ran',
        automationId: firing.automationId,
        runId: firing.runId,
        name: firing.name,
        reason: null,
      },
    });
  });

  it('never strands a message sent while the running turn ends: it is staged by one or the other', async () => {
    // The two transactions serialize on the bot's row. Without that, the send
    // can count the ending turn as active while the end looks for a queued
    // turn the send has not committed, and neither stages the new one.
    for (let round = 0; round < 25; round++) {
      const bot = await create(`Race ${round}`);
      const first = sent(bot, 'One');
      await turns.enqueue(first.turn, first.message, null);
      const running = (await turns.findForRun(first.turn.id)).unwrap();
      running.start(new Date());
      await turns.claim(running);
      running.end('completed', new Date());
      const next = sent(bot, 'Two');
      const [finished] = await Promise.all([
        turns.finish(running, null),
        turns.enqueue(next.turn, next.message, null),
      ]);
      expect(finished).toBe(true);
      expect(await stagedTurns()).toContain(next.turn.id);
    }
  });

  it('stores the end of a turn whose engine failed with more words than the column holds', async () => {
    const bot = await create('Verbose');
    const { turn, message } = sent(bot, 'One');
    await turns.enqueue(turn, message, null);
    const running = (await turns.findForRun(turn.id)).unwrap();
    running.start(new Date());
    await turns.claim(running);
    running.end('failed', new Date(), { error: 'e'.repeat(2_001) });
    expect(await turns.finish(running, null)).toBe(true);
    expect((await turns.findForRun(turn.id)).unwrap()).toMatchObject({ status: 'failed' });
  });

  it('makes the end of a turn wait for the bot row a send holds', async () => {
    const bot = await create('Locked');
    const first = sent(bot, 'One');
    await turns.enqueue(first.turn, first.message, null);
    const running = (await turns.findForRun(first.turn.id)).unwrap();
    running.start(new Date());
    await turns.claim(running);
    running.end('completed', new Date());

    const holder = dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    try {
      await holder.query(`SELECT id FROM bot WHERE id = $1 FOR NO KEY UPDATE`, [bot.id]);
      const finishing = turns.finish(running, null);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const [{ status }]: { status: string }[] = await dataSource.query(
        `SELECT status FROM bot_turn WHERE id = $1`,
        [first.turn.id],
      );
      expect(status).toBe('running');
      await holder.commitTransaction();
      expect(await finishing).toBe(true);
    } finally {
      if (holder.isTransactionActive) await holder.rollbackTransaction();
      await holder.release();
    }
  });

  it('stores the chat, makes the last message the sidebar line, and reads back history before a turn', async () => {
    const bot = await create('Glm Bot');
    const first = sent(bot, 'What is staging?');
    await turns.enqueue(first.turn, first.message, null);
    await messages.insert(
      BotMessageEntity.createNew({
        organizationId: bot.organizationId,
        botId: bot.id,
        turnId: first.turn.id,
        role: 'assistant',
        content: 'Staging is devbox.',
        steps: [],
        position: 1,
      }),
    );
    const second = sent(bot, 'And production?');
    await turns.enqueue(second.turn, second.message, null);

    const conversation = await messages.findConversation(scope(), bot.id, 10);
    expect(conversation.map((message) => message.content)).toEqual([
      'What is staging?',
      'Staging is devbox.',
      'And production?',
    ]);
    const history = await messages.findHistory(organizationId, bot.id, second.turn.id, null, 40);
    expect(history.map((message) => message.content)).toEqual([
      'What is staging?',
      'Staging is devbox.',
    ]);
    expect(await messages.findOpening(organizationId, second.turn.id)).toMatchObject({
      role: 'user',
      content: 'And production?',
    });
    const [{ lastMessagePreview }] = await dataSource.query(
      `SELECT "lastMessagePreview" FROM bot WHERE id = $1`,
      [bot.id],
    );
    expect(lastMessagePreview).toBe('And production?');
    // Another workspace reads none of it.
    const other = await insertOrganization();
    expect(await messages.findConversation(scopeOf(other), bot.id, 10)).toEqual([]);
  });

  it('cancels a queued turn and a running one only through its conditional writes', async () => {
    const bot = await create('Glm Bot');
    const { turn, message } = sent(bot, 'Wait');
    await turns.enqueue(turn, message, null);
    const loaded = (await turns.findForRun(turn.id)).unwrap();
    expect(await turns.requestCancel(loaded, new Date())).toBe(false);
    loaded.start(new Date());
    await turns.claim(loaded);
    expect(await turns.requestCancel(loaded, new Date())).toBe(true);
    expect(await turns.isCancelRequested(turn.id)).toBe(true);
  });

  it('deletes a bot with its turns and messages', async () => {
    const bot = await create('Glm Bot');
    const { turn, message } = sent(bot, 'Bye');
    await turns.enqueue(turn, message, null);
    await bots.delete(bot);
    const [{ count }] = await dataSource.query(
      `SELECT (SELECT count(*) FROM bot_turn WHERE "botId" = $1) + (SELECT count(*) FROM bot_message WHERE "botId" = $1) AS count`,
      [bot.id],
    );
    expect(Number(count)).toBe(0);
  });

  function contextResolver(): BotTurnContextResolver {
    const sealer: ProviderKeySealerPort = {
      isConfigured: () => true,
      seal: (plaintext) => Buffer.from(`sealed:${plaintext}`),
      open: (sealed) => sealed.toString().replace(/^sealed:/, ''),
    };
    // A key provider's turn never asks the ChatGPT resolver.
    const chatgpt = {} as ChatgptCredentialResolver;
    // An owner who is no longer a member: the turn still runs, reading no hosts.
    const owners = { resolve: async () => null } as unknown as BotOwnerScopeResolver;
    const hosts: OwnerHostsPort = { hostsOf: vi.fn(async () => []) };
    return new BotTurnContextResolver(
      new BotModelAccessResolver(bots, new TurnCredentialsResolver(credentials, sealer, chatgpt)),
      documents,
      memory,
      messages,
      summaries,
      owners,
      hosts,
      { tools: () => [], catalog: () => [] } as unknown as BotToolboxFactory,
      {} as BotApprovalRequestFactory,
    );
  }

  it("reads a turn's bot, documents and memory in the turn's workspace, and never another's", async () => {
    const other = await insertOrganization();
    const theirs = await create('Theirs', { organization: other });
    await memory.insert(
      BotMemoryFactEntity.createNew({
        organizationId: other,
        botId: theirs.id,
        content: 'their secret',
        actor: userActor(userId),
      }),
      50,
    );
    await credentials.put(credential('my-key-1234'));
    await credentials.put(credential('their-key-5678', other));
    // A turn of this workspace that names the other workspace's bot.
    const stray = BotTurnEntity.queue({
      organizationId,
      botId: theirs.id,
      requestedByUserId: userId,
      provider: 'glm',
      model: 'glm-5.3',
      effort: null,
    });
    await expect(contextResolver().resolve(stray, 'Hi', new Date())).rejects.toMatchObject({
      code: 'BOTS_001',
    });
    expect((await bots.findForTurn(organizationId, theirs.id)).isNone()).toBe(true);
    expect(await documents.findAllForTurn(organizationId, theirs.id)).toEqual([]);
    expect(await memory.findAllForTurn(organizationId, theirs.id)).toEqual([]);

    const mine = await create('Mine');
    const { turn } = sent(mine, 'Hi');
    const context = await contextResolver().resolve(turn, 'Hi', new Date());
    expect(context.apiKey).toBe('my-key-1234');
    expect(context.systemPrompt).toContain('You are Mine.');
    expect(context.systemPrompt).not.toContain('their secret');
    expect(context.message).toContain("The person's hosts could not be read just now");
    expect(context.tools).toEqual([]);
  });
  async function asked(bot: BotEntity, summary = 'Start Claude Code on build-02') {
    const { turn, message } = sent(bot, 'Start it');
    await turns.enqueue(turn, message, null);
    return BotApprovalEntity.request({
      organizationId: bot.organizationId,
      botId: bot.id,
      turnId: turn.id,
      tool: 'start_session',
      input: { task: 'Fix it', project_id: randomUUID(), nested: { b: 1, a: [1, 2] } },
      summary,
    });
  }

  it('keeps one card waiting per bot: a second is refused until the first is decided', async () => {
    const bot = await create('Asker');
    const first = await asked(bot, 'First');
    expect(await approvals.insertPending(first)).toBe('inserted');
    expect(await approvals.insertPending(await asked(bot, 'Second'))).toBe('pending_exists');
    // Another bot asks on its own.
    expect(await approvals.insertPending(await asked(await create('Other')))).toBe('inserted');

    const stored = (await approvals.findPending(organizationId, bot.id)).unwrap();
    expect(stored).toMatchObject({ summary: 'First', input: first.input });
    stored.deny(userId, new Date(), 'no');
    expect(await approvals.saveTransition(stored)).toBe(true);
    expect((await approvals.findPending(organizationId, bot.id)).isNone()).toBe(true);
    expect(await approvals.insertPending(await asked(bot, 'Third'))).toBe('inserted');
    const listed = await approvals.findForBot(scope(), bot.id, undefined, 50);
    expect(listed.map((approval) => approval.status)).toEqual(['pending', 'denied']);
    expect(await approvals.findForBot(scope(), bot.id, 'denied', 50)).toHaveLength(1);
    // Another workspace sees none of them.
    expect(
      await approvals.findForBot(scopeOf(await insertOrganization()), bot.id, undefined, 50),
    ).toEqual([]);
  });

  it('lets one decision win however many land at once: the rest lose and change nothing', async () => {
    const bot = await create('Racer');
    const card = await asked(bot);
    await approvals.insertPending(card);
    const copies = await Promise.all(
      Array.from({ length: 6 }, () => approvals.findOne(scope(), bot.id, card.id)),
    );
    const decided = copies.map((copy, index) => {
      const approval = copy.unwrap();
      if (index % 3 === 0) approval.approve(userId, new Date());
      else if (index % 3 === 1) approval.deny(userId, new Date(), 'no');
      else approval.expire(new Date());
      return approval;
    });
    const won = await Promise.all(decided.map((approval) => approvals.saveTransition(approval)));
    expect(won.filter(Boolean)).toHaveLength(1);
    const winner = decided[won.indexOf(true)];
    const stored = (await approvals.findOne(scope(), bot.id, card.id)).unwrap();
    expect(stored.status).toBe(winner.status);
    // The winner's next write is conditioned on what it stored.
    if (winner.status === 'approved') {
      winner.recordResult('Started session s-1.', false);
      expect(await approvals.saveTransition(winner)).toBe(true);
    }
  });

  it('opens a decision’s turn with an event: read back as its opening, never the sidebar line', async () => {
    const bot = await create('Reporter');
    const { turn, message } = sent(bot, 'Before');
    await turns.enqueue(turn, message, null);
    const next = BotTurnEntity.queue({
      organizationId,
      botId: bot.id,
      requestedByUserId: userId,
      provider: 'glm',
      model: 'glm-5.3',
      effort: null,
    });
    const event = BotMessageEntity.createNew({
      organizationId,
      botId: bot.id,
      turnId: next.id,
      role: 'event',
      content: 'Ana approved: Start Claude Code\nIt ran: Started session s-1.',
      event: { kind: 'approval', outcome: 'approved', tool: 'start_session', summary: 'Start it' },
      steps: [],
      position: 0,
    });
    expect(await turns.enqueue(next, event, null)).toBe('waiting');
    expect(await messages.findOpening(organizationId, next.id)).toMatchObject({
      role: 'event',
      event: { kind: 'approval', outcome: 'approved', tool: 'start_session', summary: 'Start it' },
      content: event.content,
    });
    const [{ lastMessagePreview }] = await dataSource.query(
      `SELECT "lastMessagePreview" FROM bot WHERE id = $1`,
      [bot.id],
    );
    expect(lastMessagePreview).toBe('Before');
  });

  it('deletes a bot’s approvals with it', async () => {
    const bot = await create('Gone');
    await approvals.insertPending(await asked(bot));
    await bots.delete(bot);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM bot_approval WHERE "botId" = $1`,
      [bot.id],
    );
    expect(count).toBe(0);
  });

  it('stages the approved call’s job with the yes, writes its result once, and queues the report with it', async () => {
    await dataSource.query(`DELETE FROM outbox_message`);
    const bot = await create('Runner');
    const card = await asked(bot);
    await approvals.insertPending(card);
    const loaded = (await approvals.findOne(scope(), bot.id, card.id)).unwrap();
    loaded.approve(userId, new Date(), ['bots:write']);
    expect(await approvals.saveTransition(loaded, { runCall: { by: 'Ana' } }, null)).toBe(true);
    const jobs: { topic: string; payload: { approvalId: string; by: string } }[] =
      await dataSource.query(
        `SELECT topic, payload FROM outbox_message WHERE topic = 'bot-approvals'`,
      );
    expect(jobs).toEqual([{ topic: 'bot-approvals', payload: { approvalId: card.id, by: 'Ana' } }]);

    // Two runs of the job: the first result lands with its report, the second writes nothing.
    const runs = await Promise.all([approvals.findForRun(card.id), approvals.findForRun(card.id)]);
    const [first, second] = runs.map((found) => found.unwrap());
    expect(first.decidedWithScopes).toEqual(['bots:write']);
    first.recordResult('Started session s-1.', false);
    second.recordResult('Started session s-1.', false);
    const report = () => {
      const { turn, message } = sent(bot, 'unused');
      const opening = BotMessageEntity.createNew({
        organizationId,
        botId: bot.id,
        turnId: turn.id,
        role: 'event',
        content: 'Ana approved: x',
        event: { kind: 'approval', outcome: 'approved', tool: 'start_session', summary: 'x' },
        steps: [],
        position: message.position,
      });
      return { turn, opening };
    };
    expect(await approvals.saveTransition(first, { continuation: report() }, null)).toBe(true);
    expect(await approvals.saveTransition(second, { continuation: report() }, null)).toBe(false);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM bot_message WHERE "botId" = $1 AND "role" = 'event'`,
      [bot.id],
    );
    expect(count).toBe(1);
  });

  it('refuses an event with nothing said about it, and a message that is not an event saying one', async () => {
    const bot = await create('Strict');
    const { turn, message } = sent(bot, 'Hi');
    await turns.enqueue(turn, message, null);
    await expect(
      dataSource.query(
        `INSERT INTO bot_message ("organizationId", "botId", "turnId", "role", "content", "position") VALUES ($1, $2, $3, 'event', 'x', 1)`,
        [organizationId, bot.id, turn.id],
      ),
    ).rejects.toMatchObject({ driverError: { constraint: 'CHK_bot_message_event' } });
  });
  // What breaks this: an outbox redelivery writing a routine's line twice, a
  // bot deleted since failing the listener forever, a turn's history or the
  // summarizer losing the lines that belong to no turn.
  it('writes a routine’s line outside any turn once, reads it back in the chat and the history', async () => {
    const bot = await create('Routines');
    const line = routineActivityLine({
      id: randomUUID(),
      organizationId,
      botId: bot.id,
      automationId: randomUUID(),
      runId: null,
      name: 'Morning PR digest',
      activity: 'paused',
      reason: 'bot_provider_missing',
      // Delivered late: the line still says when it happened.
      at: new Date(Date.now() - 3_600_000),
    });
    expect(await messages.insertOnce(line)).toBe(true);
    expect(await messages.insertOnce(line)).toBe(false);

    const { turn, message } = sent(bot, 'Why did it stop?');
    await turns.enqueue(turn, message, null);
    const conversation = await messages.findConversation(scope(), bot.id, 10);
    expect(conversation.map((item) => [item.turnId, item.role])).toEqual([
      [null, 'event'],
      [turn.id, 'user'],
    ]);
    expect(conversation[0].event).toMatchObject({
      activity: 'paused',
      reason: 'bot_provider_missing',
    });
    expect(conversation[0].createdAt).toEqual(line.createdAt);
    const history = await messages.findHistory(organizationId, bot.id, turn.id, null, 40);
    expect(history.map((item) => item.id)).toEqual([line.id]);
    const uncovered = await messages.findUncovered(organizationId, bot.id, null, 10);
    // The line has no turn to wait for; the queued message still waits on its own.
    expect(uncovered.map((item) => [item.id, item.turnEnded])).toEqual([
      [line.id, true],
      [message.id, false],
    ]);

    // A bot deleted since: the line has nowhere to go, and nothing is stored.
    const gone = routineActivityLine({
      id: randomUUID(),
      organizationId,
      botId: randomUUID(),
      automationId: randomUUID(),
      runId: null,
      name: 'Gone',
      activity: 'deleted',
      reason: null,
      at: new Date(),
    });
    expect(await messages.insertOnce(gone)).toBe(false);
    await expect(
      dataSource.query(
        `INSERT INTO bot_message ("organizationId", "botId", "role", "content", "position") VALUES ($1, $2, 'user', 'x', 0)`,
        [organizationId, bot.id],
      ),
    ).rejects.toMatchObject({ driverError: { constraint: 'CHK_bot_message_turn' } });
  });

  /** A bot with `count` messages, alternating yours and its, one turn each pair; oldest first. */
  async function talked(
    bot: BotEntity,
    count: number,
    padding = '',
  ): Promise<SummarizableMessage[]> {
    for (let index = 0; index < count; index += 2) {
      const { turn, message } = sent(bot, `Question ${index}${padding}`);
      await turns.enqueue(turn, message, null);
      const running = (await turns.findForRun(turn.id)).unwrap();
      running.start(new Date());
      await turns.claim(running);
      const answer = BotMessageEntity.createNew({
        organizationId: bot.organizationId,
        botId: bot.id,
        turnId: turn.id,
        role: 'assistant',
        content: `Answer ${index}`,
        steps: [],
        position: 1,
      });
      await messages.insert(answer);
      running.end('completed', new Date());
      await turns.finish(running, null);
    }
    // The ids, and the times as the database stored them.
    return messages.findUncovered(bot.organizationId, bot.id, null, 100);
  }

  function summaryOf(
    bot: BotEntity,
    through: SummarizableMessage,
    content: string,
    version: number,
  ): BotConversationSummaryEntity {
    return BotConversationSummaryEntity.create({
      id: bot.id,
      props: {
        organizationId: bot.organizationId,
        botId: bot.id,
        content,
        coversThroughMessageId: through.id,
        coversThroughCreatedAt: through.createdAt,
        version,
      },
    });
  }

  it('stores one first summary of two racing jobs: the other writes nothing', async () => {
    const bot = await create('Summarized');
    const conversation = await talked(bot, 6);
    const first = (content: string) =>
      BotConversationSummaryEntity.first({
        organizationId: bot.organizationId,
        botId: bot.id,
        content,
        through: conversation[3],
      });
    const [a, b] = [first('Written by A'), first('Written by B')];
    const outcomes = await Promise.all([summaries.save(a), summaries.save(b)]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const winner = outcomes[0] ? a : b;
    expect(winner.versionAtLoad).toBe(1);
    expect((outcomes[0] ? b : a).versionAtLoad).toBe(0);
    const stored = (await summaries.findForBot(organizationId, bot.id)).unwrap();
    expect(stored).toMatchObject({
      content: winner.content,
      coversThroughMessageId: conversation[3].id,
      versionAtLoad: 1,
    });
  });

  it('lets one of two revisions read at the same version win, and the loser change nothing', async () => {
    for (let round = 0; round < 10; round++) {
      const bot = await create(`Racing ${round}`);
      const conversation = await talked(bot, 8);
      const seed = BotConversationSummaryEntity.first({
        organizationId: bot.organizationId,
        botId: bot.id,
        content: 'Seed',
        through: conversation[1],
      });
      expect(await summaries.save(seed)).toBe(true);
      const a = (await summaries.findForBot(organizationId, bot.id)).unwrap();
      const b = (await summaries.findForBot(organizationId, bot.id)).unwrap();
      a.revise('Through five', conversation[5]);
      b.revise('Through three', conversation[3]);
      const outcomes = await Promise.all([summaries.save(a), summaries.save(b)]);
      expect(outcomes.filter(Boolean)).toHaveLength(1);
      const stored = (await summaries.findForBot(organizationId, bot.id)).unwrap();
      const winner = outcomes[0] ? a : b;
      expect(stored).toMatchObject({
        content: winner.content,
        coversThroughMessageId: winner.coversThroughMessageId,
        versionAtLoad: 2,
      });
    }
  });

  it('never moves the cutoff back, even from the version it was read at', async () => {
    const bot = await create('Forward');
    const conversation = await talked(bot, 6);
    expect(await summaries.save(summaryOf(bot, conversation[3], 'Through three', 0))).toBe(true);
    // A writer with the current version but an older cutoff.
    expect(await summaries.save(summaryOf(bot, conversation[1], 'Through one', 1))).toBe(false);
    // And one that names the cutoff it already has.
    expect(await summaries.save(summaryOf(bot, conversation[3], 'Again', 1))).toBe(false);
    const stored = (await summaries.findForBot(organizationId, bot.id)).unwrap();
    expect(stored).toMatchObject({ content: 'Through three', versionAtLoad: 1 });
  });

  it('refuses a cutoff that is another bot’s message', async () => {
    const bot = await create('Mine');
    const other = await create('Other');
    const theirs = await talked(other, 2);
    await talked(bot, 2);
    expect(await summaries.save(summaryOf(bot, theirs[1], 'Stolen', 0))).toBe(false);
    expect((await summaries.findForBot(organizationId, bot.id)).isNone()).toBe(true);
  });

  it('reads history and what is uncovered from just after the cutoff, to the microsecond', async () => {
    const bot = await create('Cutoff');
    const conversation = await talked(bot, 6);
    expect(await summaries.save(summaryOf(bot, conversation[2], 'Through two', 0))).toBe(true);
    const uncovered = await messages.findUncovered(organizationId, bot.id, conversation[2].id, 100);
    expect(uncovered.map((message) => message.id)).toEqual(
      conversation.slice(3).map((message) => message.id),
    );
    const { turn, message } = sent(bot, 'Next');
    await turns.enqueue(turn, message, null);
    const history = await messages.findHistory(
      organizationId,
      bot.id,
      turn.id,
      conversation[2].id,
      100,
    );
    expect(history.map((item) => item.content)).toEqual(['Answer 2', 'Question 4', 'Answer 4']);
  });

  it('never folds a queued turn’s message: the cutoff stops before the first turn not ended', async () => {
    const bot = await create('Busy');
    // Forty questions of about a thousand tokens, every turn ended: past the trigger.
    await talked(bot, 80, ` ${'x'.repeat(4_000)}`);
    // A turn runs; while it does, the next message is queued; then the running
    // turn answers, after the queued message was stored.
    const running = sent(bot, 'Deploy it');
    await turns.enqueue(running.turn, running.message, null);
    const claimed = (await turns.findForRun(running.turn.id)).unwrap();
    claimed.start(new Date());
    await turns.claim(claimed);
    const queued = sent(bot, 'And then the docs');
    expect(await turns.enqueue(queued.turn, queued.message, null)).toBe('waiting');
    await messages.insert(
      BotMessageEntity.createNew({
        organizationId: bot.organizationId,
        botId: bot.id,
        turnId: running.turn.id,
        role: 'assistant',
        content: 'Deploying.',
        steps: [],
        position: 1,
      }),
    );
    claimed.end('completed', new Date());
    await turns.finish(claimed, null);

    const uncovered = await messages.findUncovered(organizationId, bot.id, null, 100);
    const byId = new Map(uncovered.map((message) => [message.id, message]));
    expect(byId.get(running.message.id)?.turnEnded).toBe(true);
    expect(byId.get(queued.message.id)?.turnEnded).toBe(false);
    const plan = planSummary(uncovered);
    const folded = new Set([...(plan?.fold ?? []), ...(plan?.rest ?? [])].map((item) => item.id));
    expect(plan).not.toBeNull();
    expect(folded.has(queued.message.id)).toBe(false);
    // Nor anything after it, though its turn ended.
    expect(uncovered.at(-1)?.content).toBe('Deploying.');
    expect(folded.has(uncovered.at(-1)?.id ?? '')).toBe(false);
    expect(plan?.through.createdAt.getTime()).toBeLessThan(
      byId.get(queued.message.id)?.createdAt.getTime() ?? 0,
    );
  });

  it('stages a summarizing job on the outbox', async () => {
    await dataSource.query(`DELETE FROM outbox_message WHERE topic = 'bot-summaries'`);
    const bot = await create('Staged');
    await summaries.stageSummarize(organizationId, bot.id, 'corr-1');
    const rows: { payload: { organizationId: string; botId: string } }[] = await dataSource.query(
      `SELECT payload FROM outbox_message WHERE topic = 'bot-summaries'`,
    );
    expect(rows.map((row) => row.payload)).toEqual([{ organizationId, botId: bot.id }]);
  });

  it('deletes a bot’s summary with it', async () => {
    const bot = await create('Gone');
    const conversation = await talked(bot, 2);
    await summaries.save(summaryOf(bot, conversation[1], 'Bye', 0));
    await bots.delete(bot);
    expect((await summaries.findForBot(organizationId, bot.id)).isNone()).toBe(true);
  });

  /** Every row of the bot's conversation, by table. */
  async function conversationRows(botId: string) {
    const [row] = await dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM bot_turn WHERE "botId" = $1) AS turns,
         (SELECT count(*)::int FROM bot_message WHERE "botId" = $1) AS messages,
         (SELECT count(*)::int FROM bot_approval WHERE "botId" = $1) AS approvals,
         (SELECT count(*)::int FROM bot_conversation_summary WHERE "botId" = $1) AS summaries`,
      [botId],
    );
    return row as { turns: number; messages: number; approvals: number; summaries: number };
  }

  /** A conversation with a summary and a pending card on an ended turn: everything Clear erases. */
  async function fullConversation(bot: BotEntity) {
    const conversation = await talked(bot, 4);
    await summaries.save(summaryOf(bot, conversation[1], 'Earlier: two questions', 0));
    const { turn, message } = sent(bot, 'Start it');
    await turns.enqueue(turn, message, null);
    const running = (await turns.findForRun(turn.id)).unwrap();
    running.start(new Date());
    await turns.claim(running);
    const card = BotApprovalEntity.request({
      organizationId: bot.organizationId,
      botId: bot.id,
      turnId: turn.id,
      tool: 'start_session',
      input: { task: 'Fix it' },
      summary: 'Start Claude Code',
    });
    expect(await approvals.insertPending(card)).toBe('inserted');
    running.end('completed', new Date());
    expect(await turns.finish(running, null)).toBe(true);
  }

  it('clears every turn, message, card and summary of the bot, its sidebar line, and nothing of another bot', async () => {
    const bot = await create('Cleared');
    const other = await create('Kept');
    await fullConversation(bot);
    await fullConversation(other);
    const before = await conversationRows(other.id);
    expect(await conversationRows(bot.id)).toEqual({
      turns: 3,
      messages: 5,
      approvals: 1,
      summaries: 1,
    });

    expect(await turns.clearConversation(organizationId, bot.id)).toBe('cleared');

    expect(await conversationRows(bot.id)).toEqual({
      turns: 0,
      messages: 0,
      approvals: 0,
      summaries: 0,
    });
    expect(await conversationRows(other.id)).toEqual(before);
    const rows: { id: string; lastMessagePreview: string | null; lastMessageAt: Date | null }[] =
      await dataSource.query(
        `SELECT id, "lastMessagePreview", "lastMessageAt" FROM bot WHERE id = ANY($1)`,
        [[bot.id, other.id]],
      );
    expect(rows.find((row) => row.id === bot.id)).toMatchObject({
      lastMessagePreview: null,
      lastMessageAt: null,
    });
    expect(rows.find((row) => row.id === other.id)?.lastMessagePreview).toBe('Start it');
    // The bot itself, its documents and its memory stay.
    expect((await documents.findAll(scope(), bot.id)).length).toBe(2);
  });

  it('refuses to clear while a turn is queued or running, and deletes nothing', async () => {
    const bot = await create('Busy');
    await talked(bot, 2);
    const { turn, message } = sent(bot, 'Still working?');
    await turns.enqueue(turn, message, null);
    const before = await conversationRows(bot.id);
    expect(await turns.clearConversation(organizationId, bot.id)).toBe('busy');
    const running = (await turns.findForRun(turn.id)).unwrap();
    running.start(new Date());
    await turns.claim(running);
    expect(await turns.clearConversation(organizationId, bot.id)).toBe('busy');
    expect(await conversationRows(bot.id)).toEqual(before);
  });

  it('clears nothing for a bot in another workspace', async () => {
    const bot = await create('Elsewhere');
    await talked(bot, 2);
    expect(await turns.clearConversation(await insertOrganization(), bot.id)).toBe('missing');
    expect((await conversationRows(bot.id)).messages).toBe(2);
  });

  it('counts the whole chat and reads it all back a page at a time, oldest first', async () => {
    const bot = await create('Long');
    await talked(bot, 10);
    expect(await messages.countConversation(scope(), bot.id)).toBe(10);
    const read: string[] = [];
    let after: BotMessageEntity | null = null;
    for (;;) {
      const page = await messages.findExportPage(scope(), bot.id, after, 3);
      read.push(...page.map((message) => message.content));
      if (page.length < 3) break;
      after = page[page.length - 1] ?? null;
    }
    expect(read).toEqual(
      [0, 2, 4, 6, 8].flatMap((index) => [`Question ${index}`, `Answer ${index}`]),
    );
    const other = await insertOrganization();
    expect(await messages.countConversation(scopeOf(other), bot.id)).toBe(0);
    expect(await messages.findExportPage(scopeOf(other), bot.id, null, 3)).toEqual([]);
  });
});
