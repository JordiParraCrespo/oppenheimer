/**
 * A bot's dream against real Postgres (`25-bots.md` §4.1, "Dreaming"): the
 * write that swaps the facts it read for the ones it wrote, and its undo.
 * What breaks this: a dream that read a memory the bot has since saved to
 * writing over that save; the person's own facts rewritten; a dated log fact
 * losing its day; an undo that loses what the bot learned after the dream,
 * runs twice, or brings back facts the owner cleared. What the dreamer is sent
 * and how its answer is read is `bot-dream.policy.spec.ts`.
 */
import { randomUUID } from 'node:crypto';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { BOT_MEMORY_FACTS_MAX } from '@oppenheimer/shared';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { BotMapper } from '../../bots/bot.mapper';
import { BotDocumentMapper } from '../../bots/bot-document.mapper';
import { BotMemoryFactMapper } from '../../bots/bot-memory-fact.mapper';
import { BotOrmEntity } from '../../bots/database/bot.orm-entity';
import { BotRepository } from '../../bots/database/bot.repository';
import { BotDocumentOrmEntity } from '../../bots/database/bot-document.orm-entity';
import { BotDocumentRevisionOrmEntity } from '../../bots/database/bot-document-revision.orm-entity';
import { BotMemoryFactOrmEntity } from '../../bots/database/bot-memory-fact.orm-entity';
import { BotMemoryFactRepository } from '../../bots/database/bot-memory-fact.repository';
import { BotEntity } from '../../bots/domain/bot.entity';
import { type BotActor, userActor } from '../../bots/domain/bot.types';
import { BotDocumentEntity } from '../../bots/domain/bot-document.entity';
import { BotMemoryFactEntity } from '../../bots/domain/bot-memory-fact.entity';
import { BotMemoryDreamMapper } from '../bot-memory-dream.mapper';
import { BotMemoryDreamOrmEntity } from '../database/bot-memory-dream.orm-entity';
import { BotMemoryDreamRepository } from '../database/bot-memory-dream.repository';
import type { DreamWrite } from '../database/bot-memory-dream.repository.port';

describe('BotMemoryDreamRepository (integration)', () => {
  let dataSource: DataSource;
  let bots: BotRepository;
  let memory: BotMemoryFactRepository;
  let dreams: BotMemoryDreamRepository;
  let organizationId: string;
  let userId: string;
  const bot: BotActor = { kind: 'bot' };

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        BotOrmEntity,
        BotDocumentOrmEntity,
        BotDocumentRevisionOrmEntity,
        BotMemoryFactOrmEntity,
        BotMemoryDreamOrmEntity,
        OutboxMessageSchema,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    bots = new BotRepository(
      dataSource.getRepository(BotOrmEntity),
      dataSource,
      new BotMapper(),
      new BotDocumentMapper(),
    );
    memory = new BotMemoryFactRepository(
      dataSource.getRepository(BotMemoryFactOrmEntity),
      dataSource,
      new BotMemoryFactMapper(),
    );
    dreams = new BotMemoryDreamRepository(
      dataSource,
      new OutboxService(dataSource),
      new BotMemoryDreamMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [userId, `${userId}@example.com`],
    );
  });

  async function createBot(): Promise<BotEntity> {
    const created = BotEntity.createNew({
      organizationId,
      createdByUserId: userId,
      name: 'Ada',
      description: '',
      avatarColor: 'mint',
      groupId: null,
      homeHostId: null,
      provider: 'anthropic',
    });
    const docs = (['soul', 'instructions'] as const).map((name) =>
      BotDocumentEntity.initial({
        organizationId,
        botId: created.id,
        name,
        content: '',
        actor: userActor(userId),
      }),
    );
    expect(await bots.insert(created, docs)).toBe('saved');
    return created;
  }

  async function remember(owner: BotEntity, content: string, actor: BotActor = bot) {
    const fact = BotMemoryFactEntity.createNew({
      organizationId,
      botId: owner.id,
      content,
      actor,
      tier: 'log',
    });
    expect(await memory.insert(fact, BOT_MEMORY_FACTS_MAX, true)).toBe('inserted');
    return fact;
  }

  const contents = async (owner: BotEntity) =>
    (await memory.findAllForTurn(organizationId, owner.id)).map((fact) => fact.content).sort();

  async function ownFacts(owner: BotEntity) {
    const facts = await memory.findAllForTurn(organizationId, owner.id);
    return facts
      .filter((fact) => fact.source === 'bot')
      .map((fact) => ({ id: fact.id, updatedAt: fact.updatedAt }));
  }

  function dreamOf(owner: BotEntity, read: DreamWrite['read']): DreamWrite {
    return {
      id: randomUUID(),
      organizationId,
      botId: owner.id,
      read,
      facts: [
        {
          content: 'Ana prefers squash merges.',
          tier: 'profile',
          scope: 'person',
          createdAt: new Date('2026-10-20T00:00:00Z'),
        },
      ],
      note: 'Merged two.',
    };
  }

  it("replaces the bot's own facts, keeps the person's, and dates what it wrote", async () => {
    const ada = await createBot();
    await remember(ada, 'Ana likes squash merges');
    await remember(ada, 'squash merges, said Ana');
    await remember(ada, 'Call me Ana', userActor(userId));

    expect(await dreams.weigh(organizationId, ada.id)).toEqual({
      rewritable: 2,
      writesSince: 3,
      lastDreamAt: null,
    });
    const dream = dreamOf(ada, await ownFacts(ada));
    expect(await dreams.apply(dream, BOT_MEMORY_FACTS_MAX)).toBe('applied');

    const facts = await memory.findAllForTurn(organizationId, ada.id);
    expect(facts.map((fact) => fact.content).sort()).toEqual([
      'Ana prefers squash merges.',
      'Call me Ana',
    ]);
    const written = facts.find((fact) => fact.source === 'bot');
    expect(written).toMatchObject({ tier: 'profile', scope: 'person' });
    expect(written?.createdAt).toEqual(new Date('2026-10-20T00:00:00Z'));
    const latest = (await dreams.findLatest(organizationId, ada.id)).unwrap();
    expect(latest).toMatchObject({ id: dream.id, factsBefore: 2, factsAfter: 1, undoneAt: null });
    expect(await dreams.weigh(organizationId, ada.id)).toMatchObject({
      rewritable: 1,
      writesSince: 0,
    });
  });

  it('writes nothing when the bot saved after the dream read its memory', async () => {
    const ada = await createBot();
    await remember(ada, 'one');
    const read = await ownFacts(ada);
    await remember(ada, 'two, learned meanwhile');

    expect(await dreams.apply(dreamOf(ada, read), BOT_MEMORY_FACTS_MAX)).toBe('changed');
    expect(await contents(ada)).toEqual(['one', 'two, learned meanwhile']);
    expect((await dreams.findLatest(organizationId, ada.id)).isNone()).toBe(true);
  });

  it('undoes once: the old facts come back, and what the bot saved since stays', async () => {
    const ada = await createBot();
    const kept = await remember(ada, 'one');
    await remember(ada, 'two');
    expect(await dreams.apply(dreamOf(ada, await ownFacts(ada)), BOT_MEMORY_FACTS_MAX)).toBe(
      'applied',
    );
    await remember(ada, 'three, after the dream');

    const undone = await dreams.undo(organizationId, ada.id, BOT_MEMORY_FACTS_MAX);
    expect(undone?.undoneAt).toBeInstanceOf(Date);
    expect(await contents(ada)).toEqual(['one', 'three, after the dream', 'two']);
    const back = (await memory.findAllForTurn(organizationId, ada.id)).find(
      (fact) => fact.content === 'one',
    );
    expect(back?.id).toBe(kept.id);
    expect(back?.createdAt).toEqual(kept.createdAt);

    expect(await dreams.undo(organizationId, ada.id, BOT_MEMORY_FACTS_MAX)).toBeNull();
    expect(await contents(ada)).toEqual(['one', 'three, after the dream', 'two']);
  });

  it('lets the oldest log facts go when an undo would pass the cap', async () => {
    const ada = await createBot();
    await remember(ada, 'oldest');
    await remember(ada, 'older');
    expect(await dreams.apply(dreamOf(ada, await ownFacts(ada)), BOT_MEMORY_FACTS_MAX)).toBe(
      'applied',
    );
    await remember(ada, 'newest');

    await dreams.undo(organizationId, ada.id, 2);
    expect(await contents(ada)).toEqual(['newest', 'older']);
  });

  it('forgets the dream with the memory, so an undo brings nothing cleared back', async () => {
    const ada = await createBot();
    await remember(ada, 'one');
    expect(await dreams.apply(dreamOf(ada, await ownFacts(ada)), BOT_MEMORY_FACTS_MAX)).toBe(
      'applied',
    );
    await memory.clear(ada);

    expect(await dreams.undo(organizationId, ada.id, BOT_MEMORY_FACTS_MAX)).toBeNull();
    expect(await contents(ada)).toEqual([]);
  });

  it("answers missing for a bot that is gone, and stages a dream on the bot's queue", async () => {
    const ada = await createBot();
    const gone = { ...dreamOf(ada, []), botId: randomUUID() };
    expect(await dreams.apply(gone, BOT_MEMORY_FACTS_MAX)).toBe('missing');

    await dreams.stageDream(organizationId, ada.id, true, null);
    const staged: { topic: string; payload: unknown }[] = await dataSource.query(
      `SELECT topic, payload FROM outbox_message WHERE "aggregateId" = $1`,
      [ada.id],
    );
    expect(staged).toEqual([
      { topic: 'bot-dreams', payload: { organizationId, botId: ada.id, force: true } },
    ]);
  });
});
