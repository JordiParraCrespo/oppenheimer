import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { WhatsappAccountOrmEntity } from '../database/whatsapp-account.orm-entity';
import { WhatsappAccountRepository } from '../database/whatsapp-account.repository';
import { WhatsappMessageOrmEntity } from '../database/whatsapp-message.orm-entity';
import { WhatsappMessageRepository } from '../database/whatsapp-message.repository';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import type { WhatsappMessageDraft } from '../domain/whatsapp-message.types';
import { WhatsappAccountMapper } from '../whatsapp-account.mapper';
import { WhatsappMessageMapper } from '../whatsapp-message.mapper';

/**
 * WhatsApp's two tables against a real Postgres, built by the migrations: a
 * number is read only by its owner, even by a workspace-wide reader; a host
 * holds one number; a message the host sends twice is one row, and a bot's
 * send that arrives after the host's own copy marks that row rather than
 * adding a twin; chats list newest first with their last message and the name
 * last seen; search takes `%` literally; retention deletes only what is old,
 * in batches; and the messages go with their number.
 */
describe('whatsapp (integration)', () => {
  let dataSource: DataSource;
  let accounts: WhatsappAccountRepository;
  let messages: WhatsappMessageRepository;
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
      entities: [WhatsappAccountOrmEntity, WhatsappMessageOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    accounts = new WhatsappAccountRepository(
      dataSource.getRepository(WhatsappAccountOrmEntity),
      new WhatsappAccountMapper(),
    );
    messages = new WhatsappMessageRepository(
      dataSource.getRepository(WhatsappMessageOrmEntity),
      new WhatsappMessageMapper(),
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

  const number = (userId: string, host = hostId) =>
    WhatsappAccountEntity.link({ organizationId, userId, hostId: host, label: 'Spare' });

  function message(
    account: WhatsappAccountEntity,
    overrides: Partial<WhatsappMessageDraft> = {},
  ): WhatsappMessageDraft {
    return {
      accountId: account.id,
      organizationId: account.organizationId,
      externalId: randomUUID().slice(0, 10),
      chatId: '34600333444@s.whatsapp.net',
      chatKind: 'direct',
      chatName: 'Marta',
      senderId: '34600333444@s.whatsapp.net',
      senderName: 'Marta',
      fromMe: false,
      text: 'Are we still on for Tuesday?',
      media: null,
      quotedId: null,
      sentAt: new Date(),
      sentByBotId: null,
      ...overrides,
    };
  }

  it('reads a number only for its owner, a workspace-wide reader included', async () => {
    const mine = number(ana);
    await accounts.insert(mine);

    expect((await accounts.findOwnById(scopeOf(ana), mine.id)).isSome()).toBe(true);
    expect((await accounts.findOwnById(scopeOf(ben, true), mine.id)).isNone()).toBe(true);
    expect(await accounts.findAllOwn(scopeOf(ben, true))).toEqual([]);
    expect((await accounts.findByHostForSystem(hostId)).unwrap().id).toBe(mine.id);
  });

  it('holds one number per host', async () => {
    await accounts.insert(number(ana));
    await expect(accounts.insert(number(ben))).rejects.toThrow(/UQ_whatsapp_account_host/);
  });

  it('keeps the host’s report across a save', async () => {
    const mine = number(ana);
    await accounts.insert(mine);
    mine.report({ state: 'connected', phone: '34600111222@s.whatsapp.net', name: 'Ana' });
    await accounts.save(mine);
    expect((await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap()).toMatchObject({
      status: 'connected',
      phone: '34600111222@s.whatsapp.net',
      displayName: 'Ana',
    });
  });

  it('stores a message the host sends twice once, and marks a bot’s send on the host’s copy', async () => {
    const mine = number(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    const botId = randomUUID();
    await dataSource.query(
      `INSERT INTO bot ("id", "organizationId", "name") VALUES ($1, $2, 'Juno')`,
      [botId, organizationId],
    );
    const once = message(mine, { externalId: 'dup' });
    await messages.insertMany([once]);
    await messages.insertMany([once]);
    const echo = message(mine, { externalId: 'sent-1', fromMe: true });
    await messages.insertMany([echo]);
    await messages.recordBotSend({ ...echo, sentByBotId: botId });

    const kept = await messages.findInChat(ref, once.chatId, 10, null);
    expect(kept).toHaveLength(2);
    expect(await messages.countBotSendsSince(ref, new Date(Date.now() - 60_000))).toBe(1);
  });

  it('lists chats newest first with their last message and the name last seen', async () => {
    const mine = number(ana);
    await accounts.insert(mine);
    const ref = { organizationId, accountId: mine.id };
    const now = Date.now();
    await messages.insertMany([
      message(mine, { chatName: 'Marta R', sentAt: new Date(now - 3_000), text: 'first' }),
      message(mine, { chatName: null, sentAt: new Date(now - 1_000), text: 'latest from Marta' }),
      message(mine, {
        chatId: '1203@g.us',
        chatKind: 'group',
        chatName: 'Family',
        sentAt: new Date(now - 2_000),
      }),
    ]);

    const chats = await messages.findChats(ref, 10);

    expect(chats.map((chat) => [chat.chatId, chat.chatName, chat.messageCount])).toEqual([
      ['34600333444@s.whatsapp.net', 'Marta R', 2],
      ['1203@g.us', 'Family', 1],
    ]);
    expect(chats[0]?.last.text).toBe('latest from Marta');
  });

  it('searches text ignoring case, taking % literally', async () => {
    const mine = number(ana);
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

  it('deletes only old messages, a batch at a time, and every message with its number', async () => {
    const mine = number(ana);
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
    expect(await messages.findInChat(ref, '34600333444@s.whatsapp.net', 10, null)).toHaveLength(1);

    await messages.insertMany([
      message(mine, { sentAt: new Date(Date.now() - 3_000), text: 'older' }),
      message(mine, { sentAt: new Date(Date.now() - 2_000), text: 'newer' }),
    ]);
    expect(await messages.pruneBeyond(ref, 2, 500)).toBe(1);
    expect(
      (await messages.findInChat(ref, '34600333444@s.whatsapp.net', 10, null)).map(
        (kept) => kept.text,
      ),
    ).not.toContain('older');

    await accounts.delete(mine);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM whatsapp_message WHERE "accountId" = $1`,
      [mine.id],
    );
    expect(count).toBe(0);
  });
});
