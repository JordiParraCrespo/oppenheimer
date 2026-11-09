import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { TelegramAccountOrmEntity } from '../database/telegram-account.orm-entity';
import { TelegramAccountRepository } from '../database/telegram-account.repository';
import { TelegramMessageOrmEntity } from '../database/telegram-message.orm-entity';
import { TelegramMessageRepository } from '../database/telegram-message.repository';
import { hashTelegramOwnerCode, TelegramAccountEntity } from '../domain/telegram-account.entity';
import type { TelegramMessageDraft } from '../domain/telegram-message.types';
import { TelegramAccountMapper } from '../telegram-account.mapper';
import { TelegramMessageMapper } from '../telegram-message.mapper';

/**
 * Telegram's two tables against a real Postgres, built by the migrations: a
 * Telegram bot is read only by its owner, even by a workspace-wide reader; a
 * host holds one; a message the host sends twice is one row, and a bot's send
 * recorded twice marks that row rather than adding a twin; chats list newest
 * first with their last message and the name last seen; search takes `%`
 * literally; retention deletes only what is old, in batches; the messages
 * go with their Telegram bot; an owner link records one owner however many
 * open it, and none once replaced; and whether the bot has written in a chat
 * lately reads only its own sends there.
 */
describe('telegram (integration)', () => {
  let dataSource: DataSource;
  let accounts: TelegramAccountRepository;
  let messages: TelegramMessageRepository;
  let organizationId: string;
  let ana: string;
  let ben: string;
  let hostId: string;

  const scopeOf = (user: string, bypass = false): AccessScope => ({
    userId: user,
    organizationId,
    teamIds: [],
    grants: new Map(),
    bypass,
  });

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [TelegramAccountOrmEntity, TelegramMessageOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    accounts = new TelegramAccountRepository(
      dataSource.getRepository(TelegramAccountOrmEntity),
      new TelegramAccountMapper(),
    );
    messages = new TelegramMessageRepository(
      dataSource.getRepository(TelegramMessageOrmEntity),
      new TelegramMessageMapper(),
      new OutboxService(dataSource),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  async function insertUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName") VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  async function insertHost(owner: string): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, 'devbox', 'key', $3)`,
      [id, owner, randomUUID()],
    );
    return id;
  }

  beforeEach(async () => {
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    ana = await insertUser();
    ben = await insertUser();
    hostId = await insertHost(ana);
  });

  const telegramBot = (userId: string, host = hostId) =>
    TelegramAccountEntity.link({ organizationId, userId, hostId: host, label: 'Shop' });

  function message(
    account: TelegramAccountEntity,
    overrides: Partial<TelegramMessageDraft> = {},
  ): TelegramMessageDraft {
    return {
      accountId: account.id,
      organizationId: account.organizationId,
      externalId: String(Math.floor(Math.random() * 1e9)),
      chatId: '123456789',
      chatKind: 'direct',
      chatName: 'Marta',
      senderId: '123456789',
      senderName: 'Marta',
      senderUsername: 'martav',
      fromBot: false,
      text: 'Is the build green?',
      media: null,
      replyToId: null,
      sentAt: new Date(),
      sentByBotId: null,
      ...overrides,
    };
  }

  it('reads a Telegram bot only for its owner, a workspace-wide reader included', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);

    expect((await accounts.findOwnById(scopeOf(ana), mine.id)).isSome()).toBe(true);
    expect((await accounts.findOwnById(scopeOf(ben, true), mine.id)).isNone()).toBe(true);
    expect(await accounts.findAllOwn(scopeOf(ben, true))).toEqual([]);
    expect((await accounts.findByHostForSystem(hostId)).unwrap().id).toBe(mine.id);
  });

  it('holds one Telegram bot per host', async () => {
    await accounts.insert(telegramBot(ana));
    await expect(accounts.insert(telegramBot(ben))).rejects.toThrow(/UQ_telegram_account_host/);
  });

  it('keeps the host’s report across a save', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    mine.report({
      state: 'connected',
      botId: '7012345678',
      username: 'shop_helper_bot',
      name: 'Shop helper',
    });
    await accounts.save(mine);
    expect((await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap()).toMatchObject({
      status: 'connected',
      botId: '7012345678',
      username: 'shop_helper_bot',
      displayName: 'Shop helper',
    });
  });

  // What breaks this: the first message after a /new answered in the old
  // conversation because the two came in one batch and were delivered out of order.
  it('tells each owner message the last /new of its chat at or before it, the batch included', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const owner = '123456789';
    const told: Record<string, string> = {};
    const owed = {
      ownerTelegramId: owner,
      eventFor: (draft: TelegramMessageDraft) => (lastNewId: string) => {
        told[draft.externalId] = lastNewId;
        return null;
      },
    };
    await messages.insertMany(
      [
        message(mine, { externalId: '5', text: 'Hi' }),
        message(mine, { externalId: '8', text: '/new' }),
        message(mine, { externalId: '9', text: 'Fresh start' }),
        message(mine, { externalId: '10', text: '/new', senderId: '555' }),
        message(mine, { externalId: '11', text: 'Still fresh' }),
        message(mine, { externalId: '12', text: '/NEW@shop_bot please' }),
        message(mine, { externalId: '13', text: 'After a /new with a word' }),
      ],
      owed,
    );
    // The same /new the inbound policy reads: any case, an @bot and one word after it.
    expect(told).toEqual({
      '5': '0',
      '8': '8',
      '9': '8',
      '10': '8',
      '11': '8',
      '12': '12',
      '13': '12',
    });
  });

  it('stores a message the host sends twice once, and marks a bot’s send recorded twice once', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    const botId = randomUUID();
    await dataSource.query(
      `INSERT INTO bot ("id", "organizationId", "name") VALUES ($1, $2, 'Juno')`,
      [botId, organizationId],
    );
    const once = message(mine, { externalId: '41' });
    await messages.insertMany([once]);
    await messages.insertMany([once]);
    const sent = message(mine, { externalId: '42', fromBot: true, sentByBotId: botId });
    await messages.recordBotSend(sent);
    await messages.recordBotSend(sent);

    const kept = await messages.findInChat(ref, once.chatId, 10, null);
    expect(kept).toHaveLength(2);
    expect(await messages.countBotSendsSince(ref, new Date(Date.now() - 60_000))).toBe(1);
  });

  it('lists chats newest first with their last message and the name last seen', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    const now = Date.now();
    await messages.insertMany([
      message(mine, { chatName: 'Marta R', sentAt: new Date(now - 3_000), text: 'first' }),
      message(mine, { chatName: null, sentAt: new Date(now - 1_000), text: 'latest from Marta' }),
      message(mine, {
        chatId: '-1001234567890',
        chatKind: 'group',
        chatName: 'Shop team',
        sentAt: new Date(now - 2_000),
      }),
    ]);

    const chats = await messages.findChats(ref, 10);

    expect(chats.map((chat) => [chat.chatId, chat.chatName, chat.messageCount])).toEqual([
      ['123456789', 'Marta R', 2],
      ['-1001234567890', 'Shop team', 1],
    ]);
    expect(chats[0]?.last.text).toBe('latest from Marta');
  });

  it('keeps a direct chat’s @username once the bot has answered last, and gives a group none', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    const botId = randomUUID();
    await dataSource.query(
      `INSERT INTO bot ("id", "organizationId", "name") VALUES ($1, $2, 'Juno')`,
      [botId, organizationId],
    );
    const now = Date.now();
    await messages.insertMany([
      message(mine, { sentAt: new Date(now - 3_000) }),
      message(mine, {
        chatId: '-1001234567890',
        chatKind: 'group',
        chatName: 'Shop team',
        sentAt: new Date(now - 2_000),
      }),
    ]);
    await messages.recordBotSend(
      message(mine, {
        externalId: '99',
        fromBot: true,
        senderId: '7012345678',
        senderUsername: 'shop_helper_bot',
        sentAt: new Date(now - 1_000),
        sentByBotId: botId,
      }),
    );

    const chats = await messages.findChats(ref, 10);

    expect(chats.map((chat) => [chat.chatId, chat.handle, chat.last.fromBot])).toEqual([
      ['123456789', 'martav', true],
      ['-1001234567890', null, false],
    ]);
  });

  it('finds a chat by its exact id, whichever chats were active since, and no other account’s', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    const now = Date.now();
    await messages.insertMany([
      message(mine, { chatId: '111', chatName: 'Old', sentAt: new Date(now - 60_000) }),
      message(mine, { chatId: '222', chatName: 'New', sentAt: new Date(now - 1_000) }),
    ]);

    expect((await messages.findChats(ref, 1)).map((chat) => chat.chatId)).toEqual(['222']);
    expect((await messages.findChat(ref, '111')).unwrap()).toMatchObject({
      chatId: '111',
      chatName: 'Old',
      messageCount: 1,
    });
    expect((await messages.findChat(ref, '333')).isNone()).toBe(true);
    expect(
      (await messages.findChat({ organizationId, accountId: randomUUID() }, '111')).isNone(),
    ).toBe(true);
  });

  it('searches text ignoring case, taking % literally', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    await messages.insertMany([
      message(mine, { text: 'The invoice is 100% paid' }),
      message(mine, { text: 'Lunch?' }),
    ]);
    expect((await messages.search(ref, 'INVOICE', 10)).map((found) => found.text)).toEqual([
      'The invoice is 100% paid',
    ]);
    expect(await messages.search(ref, '%', 10)).toHaveLength(1);
  });

  it('deletes only old messages, a batch at a time, and every message with its Telegram bot', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    const old = new Date('2026-01-01T00:00:00Z');
    await messages.insertMany([
      message(mine, { sentAt: old }),
      message(mine, { sentAt: old }),
      message(mine, { sentAt: old }),
      message(mine),
    ]);

    expect(await messages.pruneBefore(ref, new Date('2026-06-01T00:00:00Z'), 2)).toBe(2);
    expect(await messages.pruneBefore(ref, new Date('2026-06-01T00:00:00Z'), 2)).toBe(1);
    expect(await messages.findInChat(ref, '123456789', 10, null)).toHaveLength(1);

    await messages.insertMany([
      message(mine, { sentAt: new Date(Date.now() - 3_000), text: 'older' }),
      message(mine, { sentAt: new Date(Date.now() - 2_000), text: 'newer' }),
    ]);
    expect(await messages.pruneBeyond(ref, 2, 500)).toBe(1);
    expect(
      (await messages.findInChat(ref, '123456789', 10, null)).map((kept) => kept.text),
    ).not.toContain('older');

    await accounts.delete(mine);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM telegram_message WHERE "accountId" = $1`,
      [mine.id],
    );
    expect(count).toBe(0);
  });
  async function ownerRow(id: string) {
    const [row]: {
      ownerTelegramId: string | null;
      ownerLinkCodeHash: string | null;
      ownerLinkExpiresAt: Date | null;
    }[] = await dataSource.query(
      `SELECT "ownerTelegramId", "ownerLinkCodeHash", "ownerLinkExpiresAt" FROM telegram_account WHERE id = $1`,
      [id],
    );
    return row;
  }

  // What breaks this: the conditional UPDATE losing its ownerLinkCodeHash
  // predicate, so a leaked or forwarded link makes a second person the owner.
  it('records one owner from a link opened twice in a row, and clears the link', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const { code } = mine.openOwnerLink(new Date());
    await accounts.saveOwnerLink(mine);
    const used = hashTelegramOwnerCode(code);

    const first = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
    // A copy loaded before the first claim landed, opened by someone else.
    const second = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
    expect(first.claimOwner(code, '111', new Date())).toBe(true);
    expect(await accounts.saveOwner(first, used)).toBe(true);
    expect(second.claimOwner(code, '222', new Date())).toBe(true);
    expect(await accounts.saveOwner(second, used)).toBe(false);
    // The same claim sent again is used up too.
    expect(await accounts.saveOwner(first, used)).toBe(false);

    expect(await ownerRow(mine.id)).toEqual({
      ownerTelegramId: '111',
      ownerLinkCodeHash: null,
      ownerLinkExpiresAt: null,
    });
  });

  // What breaks this: a replaced link still working, so the link the owner
  // thought they had withdrawn (sent to the wrong chat) can still be claimed.
  it('takes no owner from a link replaced by a new one, and the new link still works', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const old = mine.openOwnerLink(new Date());
    await accounts.saveOwnerLink(mine);
    const loadedWithOld = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
    const fresh = mine.openOwnerLink(new Date());
    await accounts.saveOwnerLink(mine);

    expect(loadedWithOld.claimOwner(old.code, '666', new Date())).toBe(true);
    expect(await accounts.saveOwner(loadedWithOld, hashTelegramOwnerCode(old.code))).toBe(false);
    expect(await ownerRow(mine.id)).toMatchObject({
      ownerTelegramId: null,
      ownerLinkCodeHash: hashTelegramOwnerCode(fresh.code),
    });

    const current = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
    expect(current.claimOwner(fresh.code, '111', new Date())).toBe(true);
    expect(await accounts.saveOwner(current, hashTelegramOwnerCode(fresh.code))).toBe(true);
    expect((await ownerRow(mine.id))?.ownerTelegramId).toBe('111');
  });

  // What breaks this: a stranger told 'This bot only talks to its owner.' on
  // every message (spam that gets the bot reported), never again once they
  // have written themselves, or one chat's reply silencing another chat.
  it('says the bot wrote in a chat lately only for its own send there, in that account, since the time asked', async () => {
    const mine = telegramBot(ana);
    await accounts.insert(mine);
    const otherHost = await insertHost(ben);
    const theirs = telegramBot(ben, otherHost);
    await accounts.insert(theirs);
    const ref = { organizationId, accountId: mine.id };
    const now = Date.now();
    const since = new Date(now - 24 * 60 * 60_000);
    const stranger = '555000111';

    // The stranger's own messages count for nothing.
    await messages.insertMany([
      message(mine, { chatId: stranger, senderId: stranger, sentAt: new Date(now - 60_000) }),
    ]);
    expect(await messages.wroteInChatSince(ref, stranger, since)).toBe(false);

    // The bot's line 25 hours ago is past the window.
    await messages.recordBotSend(
      message(mine, { chatId: stranger, fromBot: true, sentAt: new Date(now - 25 * 3_600_000) }),
    );
    expect(await messages.wroteInChatSince(ref, stranger, since)).toBe(false);

    // A send in another chat, or another account's send in this chat id, is not this chat's.
    await messages.recordBotSend(
      message(mine, { chatId: '999', fromBot: true, sentAt: new Date(now - 1_000) }),
    );
    await messages.recordBotSend(
      message(theirs, { chatId: stranger, fromBot: true, sentAt: new Date(now - 1_000) }),
    );
    expect(await messages.wroteInChatSince(ref, stranger, since)).toBe(false);

    // Exactly at `since` counts.
    await messages.recordBotSend(message(mine, { chatId: stranger, fromBot: true, sentAt: since }));
    expect(await messages.wroteInChatSince(ref, stranger, since)).toBe(true);
    expect(await messages.wroteInChatSince(ref, '999', since)).toBe(true);
    expect(
      await messages.wroteInChatSince({ organizationId, accountId: theirs.id }, '999', since),
    ).toBe(false);
  });
});
