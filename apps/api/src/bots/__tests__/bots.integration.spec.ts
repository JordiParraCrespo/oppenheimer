import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { NewBotProviderResolver } from '../application/new-bot-provider.resolver';
import { BotMapper } from '../bot.mapper';
import { BotDocumentMapper } from '../bot-document.mapper';
import { BotGroupMapper } from '../bot-group.mapper';
import { BotMemoryFactMapper } from '../bot-memory-fact.mapper';
import { CreateBotCommand } from '../commands/create-bot/create-bot.command';
import { CreateBotCommandHandler } from '../commands/create-bot/create-bot.command-handler';
import { BotOrmEntity } from '../database/bot.orm-entity';
import { BotRepository } from '../database/bot.repository';
import { BotDocumentOrmEntity } from '../database/bot-document.orm-entity';
import { BotDocumentRepository } from '../database/bot-document.repository';
import { BotDocumentRevisionOrmEntity } from '../database/bot-document-revision.orm-entity';
import { BotGroupOrmEntity } from '../database/bot-group.orm-entity';
import { BotGroupRepository } from '../database/bot-group.repository';
import { BotMemoryFactOrmEntity } from '../database/bot-memory-fact.orm-entity';
import { BotMemoryFactRepository } from '../database/bot-memory-fact.repository';
import { ModelProviderCredentialOrmEntity } from '../database/model-provider-credential.orm-entity';
import { ModelProviderCredentialRepository } from '../database/model-provider-credential.repository';
import { BotEntity } from '../domain/bot.entity';
import { userActor } from '../domain/bot.types';
import { BotDocumentEntity } from '../domain/bot-document.entity';
import { BotGroupEntity } from '../domain/bot-group.entity';
import { BotMemoryFactEntity } from '../domain/bot-memory-fact.entity';
import { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';

/**
 * Bots against a real Postgres (`product/versions/mvp/25-bots.md`, slice 1):
 * the migration's keys and checks, the sidebar order a move and a group delete
 * leave, the document's conditional write under two writers, the memory cap
 * under two adders, and the workspace boundary on every read; a bot made by a
 * bot, its composite "created by" link and the key that makes its creation
 * happen once, under two racing creations. The schema is the migrations', so a
 * wrong key fails here.
 */
describe('bots (integration)', () => {
  let dataSource: DataSource;
  let bots: BotRepository;
  let groups: BotGroupRepository;
  let documents: BotDocumentRepository;
  let memory: BotMemoryFactRepository;
  let credentials: ModelProviderCredentialRepository;
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
    const db = await useTestDatabase();

    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        BotOrmEntity,
        BotGroupOrmEntity,
        BotDocumentOrmEntity,
        BotDocumentRevisionOrmEntity,
        BotMemoryFactOrmEntity,
        ModelProviderCredentialOrmEntity,
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
    credentials = new ModelProviderCredentialRepository(
      dataSource.getRepository(ModelProviderCredentialOrmEntity),
      new ModelProviderCredentialMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
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
    options: {
      groupId?: string | null;
      homeHostId?: string | null;
      organization?: string;
      createdBy?: string;
    } = {},
  ): Promise<BotEntity> {
    const bot = BotEntity.createNew({
      organizationId: options.organization ?? organizationId,
      createdByUserId: options.createdBy ?? userId,
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

  it('lists the bots in the Employees order: groups by position, then Ungrouped', async () => {
    const ops = await addGroup('Ops');
    const design = await addGroup('Design');
    await create('Una');
    await create('Ola', { groupId: ops.id });
    await create('Dot', { groupId: design.id });
    await create('Oz', { groupId: ops.id });
    design.moveTo(0);
    expect(await groups.save(design)).toBe('saved');
    // A section's Bots heading narrows this list, so its order is the sidebar's.
    expect((await bots.findAll(scope())).map((bot) => bot.name)).toEqual([
      'Dot',
      'Ola',
      'Oz',
      'Una',
    ]);
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
    first.edit({ content: 'uno' }, userActor(userId));
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

  it("shares a fact about the person with the person's other bots, and nothing else", async () => {
    const ana = await create('Ana');
    const bea = await create('Bea');
    const otherUserId = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Eva', $2, 'Eva', 'Ruiz')`,
      [otherUserId, `${otherUserId}@example.com`],
    );
    const evas = await create('Evas', { createdBy: otherUserId });
    const keep = (bot: BotEntity, content: string, kept: { tier?: 'log'; scope?: 'person' } = {}) =>
      memory.insert(
        BotMemoryFactEntity.createNew({
          organizationId,
          botId: bot.id,
          content,
          ...kept,
          actor: { kind: 'bot' },
        }),
        10,
      );
    await keep(ana, 'Ana prefers squash merges.', { scope: 'person' });
    await keep(ana, 'The flaky test is the relay one.', { tier: 'log' });
    await keep(evas, 'Eva works in Lisbon.', { scope: 'person' });

    const seen = (facts: BotMemoryFactEntity[]) =>
      facts.map((fact) => [fact.content, fact.tier, fact.scope, fact.botId === ana.id]);
    expect(seen(await memory.findAll(scope(), bea.id))).toEqual([
      ['Ana prefers squash merges.', 'profile', 'person', true],
    ]);
    expect(seen(await memory.findAllForTurn(organizationId, bea.id))).toEqual([
      ['Ana prefers squash merges.', 'profile', 'person', true],
    ]);
    expect(
      (await memory.findAll(scope(), ana.id)).map((fact) => [fact.tier, fact.scope]).sort(),
    ).toEqual([
      ['log', 'bot'],
      ['profile', 'person'],
    ]);
    expect((await memory.findAll(scope(), evas.id)).map((fact) => fact.content)).toEqual([
      'Eva works in Lisbon.',
    ]);
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

  function credential(
    key: string,
    organization = organizationId,
    provider: 'glm' | 'openai' | 'chatgpt' = 'glm',
  ) {
    return ModelProviderCredentialEntity.createNew({
      organizationId: organization,
      provider,
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

  it('marks one default per workspace, keeps it across a key replace, and refuses a provider with no key', async () => {
    await credentials.put(credential('glm-key-1111'));
    await credentials.put(credential('openai-key-2222', organizationId, 'openai'));
    expect(await credentials.defaultProvider(scope())).toBe('openai');
    expect(await credentials.setDefault(scope(), 'glm')).toBe(true);
    expect(await credentials.defaultProvider(scope())).toBe('glm');
    expect(await credentials.setDefault(scope(), 'openai')).toBe(true);
    await credentials.put(credential('openai-key-3333', organizationId, 'openai'));
    const marked = (await credentials.findAll(scope())).filter((row) => row.markedDefault);
    expect(marked.map((row) => row.provider)).toEqual(['openai']);
    expect(await credentials.defaultProvider(scope())).toBe('openai');

    expect(await credentials.setDefault(scope(), 'anthropic')).toBe(false);
    const after = (await credentials.findAll(scope())).filter((row) => row.markedDefault);
    expect(after.map((row) => row.provider)).toEqual(['openai']);
  });

  it('lets a switch of default wait out one in flight instead of colliding on the index', async () => {
    await credentials.put(credential('glm-key-1111'));
    await credentials.put(credential('openai-key-2222', organizationId, 'openai'));
    // A first switch to GLM, held open between its set and its commit.
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.query(
      `UPDATE model_provider_credential SET "markedDefault" = true WHERE "organizationId" = $1 AND provider = 'glm'`,
      [organizationId],
    );
    const second = credentials.setDefault(scope(), 'openai');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await runner.commitTransaction();
    await runner.release();

    await expect(second).resolves.toBe(true);
    const marked = (await credentials.findAll(scope())).filter((row) => row.markedDefault);
    expect(marked.map((row) => row.provider)).toEqual(['openai']);
  });

  it('refuses a second default in a workspace', async () => {
    await credentials.put(credential('glm-key-1111'));
    await credentials.put(credential('openai-key-2222', organizationId, 'openai'));
    await expect(
      dataSource.query(
        `UPDATE model_provider_credential SET "markedDefault" = true WHERE "organizationId" = $1`,
        [organizationId],
      ),
    ).rejects.toMatchObject({ constraint: 'UQ_model_provider_credential_default' });
  });

  it('refuses a provider the check does not list', async () => {
    await credentials.put(credential('mine-1234'));
    await expect(
      dataSource.query(`UPDATE model_provider_credential SET provider = 'mistral'`),
    ).rejects.toMatchObject({ constraint: 'CHK_model_provider_credential_provider' });
  });

  it("rotates a sign-in's secret only over the one it read: a second refresh loses", async () => {
    await credentials.put(credential('signin-aaaa', organizationId, 'chatgpt'));
    const read = (await credentials.findForRun(organizationId, 'chatgpt')).unwrap();
    const raced = (await credentials.findForRun(organizationId, 'chatgpt')).unwrap();

    expect(
      await credentials.replaceSecretIfUnchanged(read, Buffer.from('sealed:signin-bbbb'), 'bbbb'),
    ).toBe(true);
    expect(
      await credentials.replaceSecretIfUnchanged(raced, Buffer.from('sealed:signin-cccc'), 'cccc'),
    ).toBe(false);
    const stored = (await credentials.findForRun(organizationId, 'chatgpt')).unwrap();
    expect(stored.sealedKey.toString()).toBe('sealed:signin-bbbb');
    expect(stored.keyHint).toBe('bbbb');
  });

  it('removes a refused sign-in only while it is the one read, never a newer one', async () => {
    await credentials.put(credential('signin-aaaa', organizationId, 'chatgpt'));
    const stale = (await credentials.findForRun(organizationId, 'chatgpt')).unwrap();
    await credentials.put(credential('signin-dddd', organizationId, 'chatgpt'));

    expect(await credentials.deleteIfUnchanged(stale)).toBe(false);
    expect((await credentials.findForRun(organizationId, 'chatgpt')).isSome()).toBe(true);
    const current = (await credentials.findForRun(organizationId, 'chatgpt')).unwrap();
    expect(await credentials.deleteIfUnchanged(current)).toBe(true);
    expect((await credentials.findForRun(organizationId, 'chatgpt')).isNone()).toBe(true);
  });

  describe('made by a bot', () => {
    async function madeBy(
      creator: BotEntity,
      name: string,
      idempotencyKey: string | null = null,
    ): Promise<{ bot: BotEntity; outcome: string }> {
      const bot = BotEntity.createNew({
        organizationId,
        createdByUserId: userId,
        name,
        description: '',
        avatarColor: 'mint',
        groupId: null,
        homeHostId: null,
        provider: 'glm',
        createdByBotId: creator.id,
        idempotencyKey,
      });
      const docs = (['soul', 'instructions'] as const).map((documentName) =>
        BotDocumentEntity.initial({
          organizationId,
          botId: bot.id,
          name: documentName,
          content: '',
          actor: userActor(userId),
        }),
      );
      return { bot, outcome: await bots.insert(bot, docs) };
    }

    const handler = () =>
      new CreateBotCommandHandler(
        bots,
        groups,
        {
          assertUsable: async () => ({ probedTools: null }),
        },
        new NewBotProviderResolver({ defaultProvider: async () => 'anthropic' }),
      );

    it('marks it as its creator’s, and keeps it, unmarked, when the creator is deleted', async () => {
      const ada = await create('Ada');
      const { bot, outcome } = await madeBy(ada, 'Scout');
      expect(outcome).toBe('saved');
      expect((await bots.findOneById(scope(), bot.id)).unwrap().createdByBotId).toBe(ada.id);

      await bots.delete(ada);
      const kept = (await bots.findOneById(scope(), bot.id)).unwrap();
      expect(kept.createdByBotId).toBeNull();
      expect(kept.organizationId).toBe(organizationId);
    });

    it('refuses a creator in another workspace (the composite key)', async () => {
      const theirs = await create('Theirs', { organization: await insertOrganization() });
      const mine = await create('Mine');
      await expect(
        dataSource.query(`UPDATE bot SET "createdByBotId" = $1 WHERE id = $2`, [
          theirs.id,
          mine.id,
        ]),
      ).rejects.toMatchObject({ constraint: 'FK_bot_created_by_bot' });
    });

    it('answers taken for a second creation with the same key, writing none of it', async () => {
      const ada = await create('Ada');
      const first = await madeBy(ada, 'Scout', 'bot:approval:a-1');
      const second = await madeBy(ada, 'Scout 2', 'bot:approval:a-1');
      expect([first.outcome, second.outcome]).toEqual(['saved', 'taken']);
      expect((await bots.findOneByIdempotencyKey(scope(), 'bot:approval:a-1')).unwrap().id).toBe(
        first.bot.id,
      );
      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int AS count FROM bot_document WHERE "botId" = $1`,
        [second.bot.id],
      );
      expect(count).toBe(0);
      // The key is the workspace's: another workspace may use it.
      expect((await bots.findOneByIdempotencyKey(scopeOf(null), 'bot:approval:a-1')).isNone()).toBe(
        true,
      );
    });

    it('creates no looser child when the creator is lowered between the check and the write', async () => {
      const ada = await create('Ada');
      await dataSource.query(`UPDATE bot SET permission = 'full' WHERE id = $1`, [ada.id]);
      // The owner lowers Ada to Approve for me after the handler checked her
      // level (it reads the names it numbers by after the check), before the insert.
      const lowering = Object.create(bots) as BotRepository;
      lowering.namesIn = async (caller) => {
        await dataSource.query(`UPDATE bot SET permission = 'auto' WHERE id = $1`, [ada.id]);
        return bots.namesIn(caller);
      };
      const racing = new CreateBotCommandHandler(
        lowering,
        groups,
        {
          assertUsable: async () => ({ probedTools: null }),
        },
        new NewBotProviderResolver({ defaultProvider: async () => 'anthropic' }),
      );
      await expect(
        racing.execute(
          new CreateBotCommand({
            scope: scope(),
            input: { name: 'Scout', provider: 'glm' },
            creatorBotId: ada.id,
            permission: 'full',
          }),
        ),
      ).rejects.toMatchObject({ code: 'GENERIC.ARGUMENT_INVALID' });
      expect((await bots.findAll(scope())).map((bot) => bot.name)).toEqual(['Ada']);
    });

    it('creates one bot for two racing creations with the same key, and both answer it', async () => {
      const ada = await create('Ada');
      const command = () =>
        new CreateBotCommand({
          scope: scope(),
          input: { name: 'Scout', provider: 'glm' },
          creatorBotId: ada.id,
          idempotencyKey: 'bot:approval:race',
          model: null,
          effort: null,
          permission: 'auto',
          instructions: 'Read papers.',
        });
      const ids = await Promise.all([handler().execute(command()), handler().execute(command())]);
      expect(ids[0]).toBe(ids[1]);
      const made = await dataSource.query(
        `SELECT id, "createdByBotId", "createdByUserId" FROM bot WHERE "organizationId" = $1 AND "idempotencyKey" = $2`,
        [organizationId, 'bot:approval:race'],
      );
      expect(made).toEqual([{ id: ids[0], createdByBotId: ada.id, createdByUserId: userId }]);
      const stored = await documents.findAll(scope(), ids[0]);
      expect(stored.map((document) => [document.name, document.content])).toEqual([
        ['soul', expect.stringContaining('Scout')],
        ['instructions', 'Read papers.'],
      ]);
      // A retry after both landed answers the same bot and writes nothing.
      expect(await handler().execute(command())).toBe(ids[0]);
      expect((await bots.findAll(scope())).map((bot) => bot.name)).toEqual(['Ada', 'Scout']);
    });
  });
});
