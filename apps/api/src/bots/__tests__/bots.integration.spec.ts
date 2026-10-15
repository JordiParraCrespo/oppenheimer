import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { BotMapper } from '../bot.mapper';
import { BotDocumentMapper } from '../bot-document.mapper';
import { BotGroupMapper } from '../bot-group.mapper';
import { BotMemoryFactMapper } from '../bot-memory-fact.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import { BotOrmEntity } from '../database/bot.orm-entity';
import { BotRepository } from '../database/bot.repository';
import { BotDocumentOrmEntity } from '../database/bot-document.orm-entity';
import { BotDocumentRepository } from '../database/bot-document.repository';
import { BotDocumentRevisionOrmEntity } from '../database/bot-document-revision.orm-entity';
import { BotGroupOrmEntity } from '../database/bot-group.orm-entity';
import { BotGroupRepository } from '../database/bot-group.repository';
import { BotMemoryFactOrmEntity } from '../database/bot-memory-fact.orm-entity';
import { BotMemoryFactRepository } from '../database/bot-memory-fact.repository';
import { BotMessageOrmEntity } from '../database/bot-message.orm-entity';
import { BotMessageRepository } from '../database/bot-message.repository';
import { BotTurnOrmEntity } from '../database/bot-turn.orm-entity';
import { BotTurnRepository } from '../database/bot-turn.repository';
import { ModelProviderCredentialOrmEntity } from '../database/model-provider-credential.orm-entity';
import { ModelProviderCredentialRepository } from '../database/model-provider-credential.repository';
import { BotEntity } from '../domain/bot.entity';
import { userActor } from '../domain/bot.types';
import { BotDocumentEntity } from '../domain/bot-document.entity';
import { BotGroupEntity } from '../domain/bot-group.entity';
import { BotMemoryFactEntity } from '../domain/bot-memory-fact.entity';
import { BotMessageEntity } from '../domain/bot-message.entity';
import { BotTurnEntity } from '../domain/bot-turn.entity';
import { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';

/**
 * Bots against a real Postgres (`product/versions/mvp/25-bots.md`, slice 1):
 * the migration's keys and checks, the sidebar order a move and a group delete
 * leave, the document's conditional write under two writers, the memory cap
 * under two adders, and the workspace boundary on every read. The schema is
 * the migrations', so a wrong key fails here.
 */
describe('bots (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let bots: BotRepository;
  let groups: BotGroupRepository;
  let documents: BotDocumentRepository;
  let memory: BotMemoryFactRepository;
  let credentials: ModelProviderCredentialRepository;
  let turns: BotTurnRepository;
  let messages: BotMessageRepository;
  let organizationId: string;
  let userId: string;

  const scopeOf = (organization: string | null): AccessScope => ({
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
        BotGroupOrmEntity,
        BotDocumentOrmEntity,
        BotDocumentRevisionOrmEntity,
        BotMemoryFactOrmEntity,
        ModelProviderCredentialOrmEntity,
        BotTurnOrmEntity,
        BotMessageOrmEntity,
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
    groups = new BotGroupRepository(
      dataSource.getRepository(BotGroupOrmEntity),
      dataSource,
      new BotGroupMapper(),
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
    const outbox = new OutboxService(dataSource);
    turns = new BotTurnRepository(
      dataSource.getRepository(BotTurnOrmEntity),
      outbox,
      new BotTurnMapper(),
      new BotMessageMapper(),
    );
    messages = new BotMessageRepository(
      dataSource.getRepository(BotMessageOrmEntity),
      dataSource,
      new BotMessageMapper(),
    );
    credentials = new ModelProviderCredentialRepository(
      dataSource.getRepository(ModelProviderCredentialOrmEntity),
      new ModelProviderCredentialMapper(),
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

  async function insertHost(): Promise<string> {
    const hostId = randomUUID();
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, 'devbox', 'key', $3)`,
      [hostId, userId, randomUUID()],
    );
    return hostId;
  }

  async function create(
    name: string,
    options: { groupId?: string | null; homeHostId?: string | null; organization?: string } = {},
  ): Promise<BotEntity> {
    const bot = BotEntity.createNew({
      organizationId: options.organization ?? organizationId,
      createdByUserId: userId,
      name,
      description: '',
      avatarColor: 'mint',
      groupId: options.groupId ?? null,
      homeHostId: options.homeHostId ?? null,
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

  async function addGroup(name: string): Promise<BotGroupEntity> {
    const group = BotGroupEntity.createNew({ organizationId, name });
    expect(await groups.insert(group)).toBe('saved');
    return group;
  }

  const order = async (groupId: string | null) =>
    (await bots.findAll(scope()))
      .filter((bot) => bot.groupId === groupId)
      .map((bot) => [bot.name, bot.position]);

  it('creates a bot last in its group, with both documents and their first revisions', async () => {
    await create('Ana');
    const bea = await create('Bea');
    expect(await order(null)).toEqual([
      ['Ana', 0],
      ['Bea', 1],
    ]);
    const stored = await documents.findAll(scope(), bea.id);
    expect(stored.map((document) => [document.name, document.revision])).toEqual([
      ['soul', 1],
      ['instructions', 1],
    ]);
    const history = await documents.findRevisions(scope(), bea.id, 'soul', 50);
    expect(history).toMatchObject([
      { revision: 1, content: 'You are Bea.', author: 'user', authorUserId: userId },
    ]);
  });

  it('moves a bot into a group at an index and closes up both lists', async () => {
    const group = await addGroup('Engineering');
    const ana = await create('Ana');
    await create('Bea');
    await create('Cid', { groupId: group.id });
    await create('Dee', { groupId: group.id });

    const moved = (await bots.findOneById(scope(), ana.id)).unwrap();
    moved.moveTo(group.id, 1);
    expect(await bots.save(moved)).toBe('saved');
    expect(moved.position).toBe(1);
    expect(await order(group.id)).toEqual([
      ['Cid', 0],
      ['Ana', 1],
      ['Dee', 2],
    ]);
    // The list it left keeps its order; the gap is harmless and closes on the next move.
    expect((await order(null)).map(([name]) => name)).toEqual(['Bea']);
  });

  it('keeps both of two edits made from the same copy: each writes only what it changed', async () => {
    const group = await addGroup('Engineering');
    const ana = await create('Ana');
    const recoloured = (await bots.findOneById(scope(), ana.id)).unwrap();
    const regrouped = (await bots.findOneById(scope(), ana.id)).unwrap();

    recoloured.edit({ avatarColor: 'coral' });
    regrouped.moveTo(group.id, undefined);
    regrouped.edit({ model: 'claude-opus-5-5', effort: 'high' });
    expect(await bots.save(recoloured)).toBe('saved');
    expect(await bots.save(regrouped)).toBe('saved');

    expect((await bots.findOneById(scope(), ana.id)).unwrap()).toMatchObject({
      avatarColor: 'coral',
      groupId: group.id,
      model: 'claude-opus-5-5',
      effort: 'high',
    });
  });

  it('answers group-missing for a move into a group deleted under it, and writes nothing', async () => {
    const group = await addGroup('Gone');
    const ana = await create('Ana');
    await groups.delete(group);
    const moved = (await bots.findOneById(scope(), ana.id)).unwrap();
    moved.moveTo(group.id, undefined);
    expect(await bots.save(moved)).toBe('group-missing');
    expect((await bots.findOneById(scope(), ana.id)).unwrap().groupId).toBeNull();
  });

  it('deleting a group appends its bots, in order, after the ungrouped ones', async () => {
    const group = await addGroup('Ops');
    await create('Ana');
    await create('Cid', { groupId: group.id });
    await create('Dee', { groupId: group.id });
    await groups.delete(group);
    expect(await order(null)).toEqual([
      ['Ana', 0],
      ['Cid', 1],
      ['Dee', 2],
    ]);
    expect((await groups.findOneById(scope(), group.id)).isNone()).toBe(true);
  });

  it('keeps group names unique in a workspace whatever their case, and not across workspaces', async () => {
    await addGroup('Engineering');
    expect(
      await groups.insert(BotGroupEntity.createNew({ organizationId, name: 'engineering' })),
    ).toBe('name-taken');
    const other = await insertOrganization();
    expect(
      await groups.insert(BotGroupEntity.createNew({ organizationId: other, name: 'Engineering' })),
    ).toBe('saved');
  });

  it('reorders groups, renumbering the sidebar', async () => {
    const a = await addGroup('A');
    await addGroup('B');
    const c = await addGroup('C');
    c.moveTo(0);
    expect(await groups.save(c)).toBe('saved');
    expect((await groups.findAll(scope())).map((group) => [group.name, group.position])).toEqual([
      ['C', 0],
      ['A', 1],
      ['B', 2],
    ]);
    expect((await groups.findOneById(scope(), a.id)).unwrap().position).toBe(1);
  });

  it('lets one of two writers that read the same revision win, and records only its revision', async () => {
    const bot = await create('Ana');
    const first = (await documents.findOne(scope(), bot.id, 'instructions')).unwrap();
    const second = (await documents.findOne(scope(), bot.id, 'instructions')).unwrap();
    first.write({ content: 'Ship on Thursdays.', baseRevision: 1, actor: userActor(userId) });
    second.write({ content: 'Ship on Fridays.', baseRevision: 1, actor: userActor(userId) });

    expect(await documents.save(first)).toBe('saved');
    expect(await documents.save(second)).toBe('conflict');

    const current = (await documents.findOne(scope(), bot.id, 'instructions')).unwrap();
    expect([current.content, current.revision]).toEqual(['Ship on Thursdays.', 2]);
    const history = await documents.findRevisions(scope(), bot.id, 'instructions', 50);
    expect(history.map((revision) => [revision.revision, revision.content])).toEqual([
      [2, 'Ship on Thursdays.'],
      [1, ''],
    ]);
  });

  it('reverts by appending, and keeps the history newest first and bounded', async () => {
    const bot = await create('Ana');
    for (const content of ['one', 'two']) {
      const document = (await documents.findOne(scope(), bot.id, 'soul')).unwrap();
      document.write({ content, baseRevision: document.revision, actor: userActor(userId) });
      expect(await documents.save(document)).toBe('saved');
    }
    const document = (await documents.findOne(scope(), bot.id, 'soul')).unwrap();
    const target = (await documents.findRevision(scope(), bot.id, 'soul', 2)).unwrap();
    expect(document.revertTo(target, userActor(userId))).toBe('written');
    expect(await documents.save(document)).toBe('saved');

    const history = await documents.findRevisions(scope(), bot.id, 'soul', 2);
    expect(
      history.map((revision) => [revision.revision, revision.content, revision.revertedFrom]),
    ).toEqual([
      [4, 'one', 2],
      [3, 'two', null],
    ]);
    expect((await documents.findRevision(scope(), bot.id, 'soul', 2 ** 40)).isNone()).toBe(true);
  });

  it('lets only one of two adders take the last memory place', async () => {
    const bot = await create('Ana');
    const fact = (content: string) =>
      BotMemoryFactEntity.createNew({
        organizationId,
        botId: bot.id,
        content,
        actor: userActor(userId),
      });
    const outcomes = await Promise.all([
      memory.insert(fact('Releases go out on Thursdays.'), 1),
      memory.insert(fact('The staging host is devbox.'), 1),
    ]);
    expect(outcomes.sort()).toEqual(['full', 'inserted']);
    expect(await memory.findAll(scope(), bot.id)).toHaveLength(1);
  });

  it('edits, forgets and clears memory', async () => {
    const bot = await create('Ana');
    const first = BotMemoryFactEntity.createNew({
      organizationId,
      botId: bot.id,
      content: 'one',
      actor: { kind: 'bot' },
    });
    const second = BotMemoryFactEntity.createNew({
      organizationId,
      botId: bot.id,
      content: 'two',
      actor: userActor(userId),
    });
    await memory.insert(first, 10);
    await memory.insert(second, 10);
    first.edit('uno', userActor(userId));
    expect(await memory.save(first)).toBe('saved');
    expect((await memory.findOneById(scope(), bot.id, first.id)).unwrap()).toMatchObject({
      content: 'uno',
      source: 'user',
    });
    await memory.delete(second);
    expect((await memory.findAll(scope(), bot.id)).map((fact) => fact.content)).toEqual(['uno']);
    await memory.clear(bot);
    expect(await memory.findAll(scope(), bot.id)).toEqual([]);
  });

  it('reads nothing of another workspace’s bot', async () => {
    const other = await insertOrganization();
    const theirs = await create('Theirs', { organization: other });
    expect((await bots.findOneById(scope(), theirs.id)).isNone()).toBe(true);
    expect(await bots.findAll(scope())).toEqual([]);
    expect(await documents.findAll(scope(), theirs.id)).toEqual([]);
    expect(await documents.findRevisions(scope(), theirs.id, 'soul', 50)).toEqual([]);
    expect(await memory.findAll(scope(), theirs.id)).toEqual([]);
    expect(await bots.findAll(scopeOf(null))).toEqual([]);
  });

  it('deletes a bot with its documents, history and memory', async () => {
    const bot = await create('Ana');
    await memory.insert(
      BotMemoryFactEntity.createNew({
        organizationId,
        botId: bot.id,
        content: 'one',
        actor: userActor(userId),
      }),
      10,
    );
    await bots.delete(bot);
    const [left] = await dataSource.query(
      `SELECT (SELECT count(*) FROM bot_document WHERE "botId" = $1)::int AS documents,
              (SELECT count(*) FROM bot_document_revision WHERE "botId" = $1)::int AS revisions,
              (SELECT count(*) FROM bot_memory_fact WHERE "botId" = $1)::int AS facts`,
      [bot.id],
    );
    expect(left).toEqual({ documents: 0, revisions: 0, facts: 0 });
  });

  it('keeps a bot whose home host is removed, with no home host', async () => {
    const hostId = await insertHost();
    const bot = await create('Ana', { homeHostId: hostId });
    await dataSource.query(`DELETE FROM host WHERE id = $1`, [hostId]);
    expect((await bots.findOneById(scope(), bot.id)).unwrap().homeHostId).toBeNull();
  });

  it('refuses rows the checks forbid: a colour off the palette, a bot revision with a person', async () => {
    const bot = await create('Ana');
    await expect(
      dataSource.query(`UPDATE bot SET "avatarColor" = 'teal' WHERE id = $1`, [bot.id]),
    ).rejects.toMatchObject({ constraint: 'CHK_bot_avatar_color' });
    await expect(
      dataSource.query(
        `UPDATE bot_document SET "updatedBy" = 'bot' WHERE "botId" = $1 AND name = 'soul'`,
        [bot.id],
      ),
    ).rejects.toMatchObject({ constraint: 'CHK_bot_document_bot_has_no_user' });
  });

  it('grants the workspace owner the Bot subject, through the migration', async () => {
    const [owner] = await dataSource.query(
      `SELECT permissions FROM "role" WHERE name = 'owner' AND "organizationId" IS NULL`,
    );
    expect(owner.permissions).toContainEqual({
      action: 'manage',
      subject: 'Bot',
      conditions: { organizationId: '${activeOrganizationId}' },
    });
  });

  function credential(key: string, organization = organizationId) {
    return ModelProviderCredentialEntity.createNew({
      organizationId: organization,
      provider: 'glm',
      sealedKey: Buffer.from(`sealed:${key}`),
      keyHint: key.slice(-4),
      updatedByUserId: userId,
    });
  }

  it('keeps one key per workspace and provider: a second put replaces the first', async () => {
    await credentials.put(credential('first-key-1111'));
    await credentials.put(credential('second-key-2222'));
    const stored = await credentials.findAll(scope());
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ provider: 'glm', keyHint: '2222' });
    expect(stored[0].sealedKey.toString()).toBe('sealed:second-key-2222');
  });

  it("reads and deletes no other workspace's key", async () => {
    const other = await insertOrganization();
    await credentials.put(credential('theirs-9999', other));
    expect(await credentials.findAll(scope())).toEqual([]);
    expect((await credentials.findOne(scope(), 'glm')).isNone()).toBe(true);
    expect(await credentials.delete(scope(), 'glm')).toBe(false);
    expect(await credentials.findAll(scopeOf(other))).toHaveLength(1);
  });

  it('forgets a key on delete, and with its workspace', async () => {
    await credentials.put(credential('mine-1234'));
    expect(await credentials.delete(scope(), 'glm')).toBe(true);
    expect(await credentials.findAll(scope())).toEqual([]);
    await credentials.put(credential('mine-5678'));
    await dataSource.query(`DELETE FROM organization WHERE id = $1`, [organizationId]);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM model_provider_credential WHERE "organizationId" = $1`,
      [organizationId],
    );
    expect(count).toBe(0);
  });

  it('refuses a provider the check does not list', async () => {
    await credentials.put(credential('mine-1234'));
    await expect(
      dataSource.query(`UPDATE model_provider_credential SET provider = 'mistral'`),
    ).rejects.toMatchObject({ constraint: 'CHK_model_provider_credential_provider' });
  });

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
    expect(await messages.findPrompt(organizationId, second.turn.id)).toBe('And production?');
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
});
