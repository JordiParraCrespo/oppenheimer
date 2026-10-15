import { randomUUID } from 'node:crypto';
import type { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
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
import type { BotOwnerScopeResolver } from '../application/bot-owner-scope.resolver';
import { BotTurnContextResolver } from '../application/bot-turn-context.resolver';
import { BotApprovalMapper } from '../bot-approval.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import { BotApprovalOrmEntity } from '../database/bot-approval.orm-entity';
import { BotApprovalRepository } from '../database/bot-approval.repository';
import { BotMessageOrmEntity } from '../database/bot-message.orm-entity';
import { BotMessageRepository } from '../database/bot-message.repository';
import { BotTurnOrmEntity } from '../database/bot-turn.orm-entity';
import { BotTurnRepository } from '../database/bot-turn.repository';
import { BotApprovalEntity } from '../domain/bot-approval.entity';
import { BotMessageEntity } from '../domain/bot-message.entity';
import { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * A bot's chat against a real Postgres (`product/versions/mvp/25-bots.md`
 * §2–3): one running turn per bot and the next staged when it ends, a send
 * racing the end of a turn, the failure a turn's column holds, the stored
 * conversation and history, Stop's conditional writes, the cascade from the
 * bot, and a turn's context read in its own workspace only; Needs input
 * cards: one waiting per bot, decided once however many decide at once, the
 * event that opens a decision's turn, and the cascade. The schema is the
 * migrations'.
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
    );
    messages = new BotMessageRepository(
      dataSource.getRepository(BotMessageOrmEntity),
      dataSource,
      new BotMessageMapper(),
    );
    approvals = new BotApprovalRepository(
      dataSource.getRepository(BotApprovalOrmEntity),
      new BotApprovalMapper(),
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
    const history = await messages.findHistory(organizationId, bot.id, second.turn.id, 40);
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
    // An owner who is no longer a member: the turn still runs, reading no hosts.
    const owners = { resolve: async () => null } as unknown as BotOwnerScopeResolver;
    const queryBus = { execute: vi.fn() } as unknown as QueryBus;
    return new BotTurnContextResolver(
      bots,
      documents,
      memory,
      messages,
      credentials,
      sealer,
      owners,
      queryBus,
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
    expect(context.systemPrompt).toContain("The person's hosts could not be read just now");
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
      steps: [],
      position: 0,
    });
    expect(await turns.enqueue(next, event, null)).toBe('waiting');
    expect(await messages.findOpening(organizationId, next.id)).toMatchObject({
      role: 'event',
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
});
