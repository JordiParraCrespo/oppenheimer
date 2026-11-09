import { randomUUID } from 'node:crypto';
import type { CommandBus } from '@nestjs/cqrs';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import type { TurnCredentialsPort } from '../../bots/application/turn-credentials.port';
import { BotMapper } from '../../bots/bot.mapper';
import { BotDocumentMapper } from '../../bots/bot-document.mapper';
import { BotOrmEntity } from '../../bots/database/bot.orm-entity';
import { BotRepository } from '../../bots/database/bot.repository';
import { BotDocumentOrmEntity } from '../../bots/database/bot-document.orm-entity';
import { BotDocumentRevisionOrmEntity } from '../../bots/database/bot-document-revision.orm-entity';
import { BotEntity } from '../../bots/domain/bot.entity';
import { userActor } from '../../bots/domain/bot.types';
import { BotDocumentEntity } from '../../bots/domain/bot-document.entity';
import { BotChannelWakeResolver } from '../application/bot-channel-wake.resolver';
import { BotModelAccessResolver } from '../application/bot-model-access.resolver';
import { BotWhatsappWakeDomainEventHandler } from '../application/event-handlers/bot-whatsapp-wake.domain-event-handler';
import { BotGoalMapper } from '../bot-goal.mapper';
import { BotLoopMapper } from '../bot-loop.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import type { WakeOnWhatsappCommand } from '../commands/wake-on-whatsapp/wake-on-whatsapp.command';
import { WakeOnWhatsappCommandHandler } from '../commands/wake-on-whatsapp/wake-on-whatsapp.command-handler';
import { BotConversationRepository } from '../database/bot-conversation.repository';
import { BotGoalOrmEntity } from '../database/bot-goal.orm-entity';
import { BotLoopOrmEntity } from '../database/bot-loop.orm-entity';
import { BotMessageOrmEntity } from '../database/bot-message.orm-entity';
import { BotTurnOrmEntity } from '../database/bot-turn.orm-entity';
import { BotTurnRepository } from '../database/bot-turn.repository';
import { BotMessageEntity } from '../domain/bot-message.entity';
import { BotTurnEntity } from '../domain/bot-turn.entity';
import { whatsappSourceKey } from '../domain/bot-whatsapp-turn.policy';

/**
 * The confirmed owner's messages to their linked number, as the outbox
 * delivers them (`WhatsappOwnerWroteDomainEvent`): one turn per stored
 * message in the WhatsApp chat's own conversation, however often it is
 * delivered; a switch by name opening the named bot's conversation at the
 * switch, and a switch back opening the first bot's afresh; `/new` and
 * `/stop` acting on that chat's conversation alone; and nothing for a bot
 * the number's owner did not make. The schema is the migrations'.
 */
describe('waking a bot on WhatsApp (integration)', () => {
  let dataSource: DataSource;
  let bots: BotRepository;
  let turns: BotTurnRepository;
  let events: BotWhatsappWakeDomainEventHandler;
  let organizationId: string;
  let userId: string;
  let accountId: string;
  let juno: BotEntity;
  const chatId = '34600111222@s.whatsapp.net';

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        BotOrmEntity,
        BotDocumentOrmEntity,
        BotDocumentRevisionOrmEntity,
        BotTurnOrmEntity,
        BotMessageOrmEntity,
        BotGoalOrmEntity,
        BotLoopOrmEntity,
        OutboxMessageSchema,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    bots = new BotRepository(
      dataSource.getRepository(BotOrmEntity),
      new BotMapper(),
      new BotDocumentMapper(),
      new OutboxService(dataSource),
    );
    turns = new BotTurnRepository(
      dataSource.getRepository(BotTurnOrmEntity),
      new OutboxService(dataSource),
      new BotTurnMapper(),
      new BotMessageMapper(),
      new BotConversationRepository(dataSource),
      new BotGoalMapper(),
      new BotLoopMapper(),
    );
    // The real bot lookup; a wake never reads a credential.
    const wakeOn = new WakeOnWhatsappCommandHandler(
      new BotChannelWakeResolver(new BotConversationRepository(dataSource), turns),
      new BotModelAccessResolver(bots, {} as TurnCredentialsPort),
    );
    const commands = {
      execute: (command: WakeOnWhatsappCommand) => wakeOn.execute(command),
    } as unknown as CommandBus;
    events = new BotWhatsappWakeDomainEventHandler(commands);
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    userId = await insertUser();
    const hostId = randomUUID();
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, 'phonebox', 'key', $3)`,
      [hostId, userId, randomUUID()],
    );
    [{ id: accountId }] = await dataSource.query(
      `INSERT INTO whatsapp_account ("organizationId", "userId", "hostId", label)
       VALUES ($1, $2, $3, 'Spare') RETURNING id`,
      [organizationId, userId, hostId],
    );
    juno = await create('Juno');
  });

  async function insertUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  async function create(name: string, createdByUserId = userId): Promise<BotEntity> {
    const bot = BotEntity.createNew({
      organizationId,
      createdByUserId,
      name,
      description: '',
      avatarColor: 'mint',
      groupId: null,
      homeHostId: null,
      provider: 'anthropic',
    });
    const docs = (['soul', 'instructions'] as const).map((documentName) =>
      BotDocumentEntity.initial({
        organizationId,
        botId: bot.id,
        name: documentName,
        content: documentName === 'soul' ? `You are ${name}.` : '',
        actor: userActor(createdByUserId),
      }),
    );
    expect(await bots.insert(bot, docs)).toBe('saved');
    return bot;
  }

  /** The rows each message of the test is stored as, by seq. */
  const rows = new Map<string, string>();
  const rowOf = (seq: string) => {
    if (!rows.has(seq)) rows.set(seq, randomUUID());
    return rows.get(seq) ?? '';
  };

  /** The event the intake stages for the owner's message at `seq`, as the outbox hands it on. */
  const wrote = (
    seq: string,
    overrides: Partial<Parameters<BotWhatsappWakeDomainEventHandler['handle']>[0]> = {},
  ) =>
    events.handle({
      organizationId,
      userId,
      accountId,
      chatId,
      messageRowId: rowOf(seq),
      seq,
      botId: juno.id,
      conversationStartsAt: '0',
      command: 'message',
      text: `Message ${seq}`,
      metadata: { correlationId: randomUUID(), timestamp: Date.now() },
      ...overrides,
    });

  async function whatsappTurns(
    bot: BotEntity = juno,
  ): Promise<{ id: string; conversationId: string; sourceKey: string }[]> {
    return dataSource.query(
      `SELECT id, "conversationId", "sourceKey" FROM bot_turn
        WHERE "botId" = $1 AND origin = 'whatsapp' ORDER BY "createdAt", id`,
      [bot.id],
    );
  }

  async function conversationOf(
    conversationId: string,
  ): Promise<{ kind: string; whatsappAccountId: string; chatId: string; startsAt: string }> {
    const [row] = await dataSource.query(
      `SELECT kind, "whatsappAccountId", "chatId", "startsAtMessageId"::text AS "startsAt"
         FROM bot_conversation WHERE id = $1`,
      [conversationId],
    );
    return row;
  }

  const sourceOf = (seq: string) =>
    whatsappSourceKey({ whatsappAccountId: accountId, messageRowId: rowOf(seq) });

  async function claimed(turnId: string): Promise<BotTurnEntity> {
    const turn = (await turns.findForRun(turnId)).unwrap();
    turn.start(new Date());
    expect(await turns.claim(turn)).toBe('claimed');
    return turn;
  }

  // What breaks this: a redelivered message running twice; the owner's
  // WhatsApp message answered in the console chat (or a Telegram-kind row);
  // the event's account read from somewhere other than `accountId`.
  it('queues one turn per owner’s message in the WhatsApp chat’s own conversation, however often it is delivered', async () => {
    await wrote('9');
    await wrote('9');

    const queued = await whatsappTurns();
    expect(queued.map((turn) => turn.sourceKey)).toEqual([sourceOf('9')]);
    const conversationId = queued[0]?.conversationId ?? '';
    expect(conversationId).not.toBe(juno.id);
    expect(await conversationOf(conversationId)).toEqual({
      kind: 'whatsapp',
      whatsappAccountId: accountId,
      chatId,
      startsAt: '0',
    });
    const opening: { content: string }[] = await dataSource.query(
      `SELECT content FROM bot_message WHERE "conversationId" = $1`,
      [conversationId],
    );
    expect(opening.map((message) => message.content)).toEqual(['Message 9']);
    const inConsole: { count: number }[] = await dataSource.query(
      `SELECT count(*)::int AS count FROM bot_message WHERE "conversationId" = $1`,
      [juno.id],
    );
    expect(inConsole).toEqual([{ count: 0 }]);
  });

  // What breaks this: "Shop: …" answered by Shop inside Juno's history (or
  // Shop's old one), or switching back to Juno resuming the conversation the
  // owner left, so its turns read what was said to Shop in between.
  it('opens the named bot’s conversation at a switch, and the first bot’s afresh when switched back', async () => {
    const shop = await create('Shop');
    await wrote('10');
    await wrote('11', { botId: shop.id, conversationStartsAt: '11' });
    await wrote('12', { botId: shop.id, conversationStartsAt: '11' });
    await wrote('13', { botId: juno.id, conversationStartsAt: '13' });

    const [atShop, afterShop] = await whatsappTurns(shop);
    expect(atShop?.conversationId).toBe(afterShop?.conversationId);
    expect((await conversationOf(atShop?.conversationId ?? '')).startsAt).toBe('11');

    const [first, back] = await whatsappTurns();
    expect(first?.sourceKey).toBe(sourceOf('10'));
    expect(back?.sourceKey).toBe(sourceOf('13'));
    expect(back?.conversationId).not.toBe(first?.conversationId);
    expect((await conversationOf(first?.conversationId ?? '')).startsAt).toBe('0');
    expect((await conversationOf(back?.conversationId ?? '')).startsAt).toBe('13');
  });

  // What breaks this: /new sent to the model as a message, or the message
  // after it answered in the conversation before it.
  it('starts a conversation at a /new itself and queues no turn for it', async () => {
    await wrote('20', { command: 'new', conversationStartsAt: '20', text: '' });
    expect(await whatsappTurns()).toEqual([]);

    await wrote('21', { conversationStartsAt: '20' });
    const [after] = await whatsappTurns();
    expect((await conversationOf(after?.conversationId ?? '')).startsAt).toBe('20');
  });

  // What breaks this: /stop on WhatsApp cancelling the console's turn, or
  // nothing at all.
  it('asks only the running turn of the WhatsApp chat to stop, never the console’s', async () => {
    const inConsole = await runningInConsole();
    await wrote('30', { command: 'stop', text: '' });
    expect(await turns.isCancelRequested(inConsole.id)).toBe(false);

    await wrote('31');
    inConsole.end('completed', new Date());
    expect(await turns.finish(inConsole, null)).toBe(true);
    const [onWhatsapp] = await whatsappTurns();
    const running = await claimed(onWhatsapp?.id ?? '');

    await wrote('32', { command: 'stop', text: '' });

    expect(await turns.isCancelRequested(running.id)).toBe(true);
    expect(await turns.isCancelRequested(inConsole.id)).toBe(false);
    expect((await whatsappTurns()).map((turn) => turn.sourceKey)).toEqual([sourceOf('31')]);
  });

  // What breaks this: a switch by name to a workspace bot someone else made
  // answering the owner with that bot's tools and memory.
  it('queues nothing for a bot the number’s owner did not make', async () => {
    const theirs = await create('Shop', await insertUser());
    await wrote('40', { botId: theirs.id, conversationStartsAt: '40' });
    await wrote('41', { botId: theirs.id, conversationStartsAt: '40', command: 'new' });

    expect(await whatsappTurns(theirs)).toEqual([]);
    const [{ count }]: { count: number }[] = await dataSource.query(
      `SELECT count(*)::int AS count FROM bot_conversation WHERE "botId" = $1`,
      [theirs.id],
    );
    expect(count).toBe(0);
  });

  async function runningInConsole(): Promise<BotTurnEntity> {
    const turn = BotTurnEntity.queue({
      organizationId,
      botId: juno.id,
      requestedByUserId: userId,
      provider: 'glm',
      model: 'glm-5.3',
      effort: null,
    });
    const message = BotMessageEntity.createNew({
      organizationId,
      botId: juno.id,
      turnId: turn.id,
      role: 'user',
      content: 'In the console',
      steps: [],
      position: 0,
    });
    await turns.enqueue(turn, message, null);
    return claimed(turn.id);
  }
});
