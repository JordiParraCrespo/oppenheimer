import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { WhatsappAccountOrmEntity } from '../database/whatsapp-account.orm-entity';
import { WhatsappAccountRepository } from '../database/whatsapp-account.repository';
import { WhatsappMessageOrmEntity } from '../database/whatsapp-message.orm-entity';
import { WhatsappMessageRepository } from '../database/whatsapp-message.repository';
import type { WhatsappMessagesOwed } from '../database/whatsapp-message.repository.port';
import { WhatsappOwnerWroteDomainEvent } from '../domain/events/whatsapp-owner-wrote.domain-event';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import type { WhatsappMessageDraft } from '../domain/whatsapp-message.types';
import { hashWhatsappOwnerCode } from '../domain/whatsapp-owner-code.policy';
import { WhatsappAccountMapper } from '../whatsapp-account.mapper';
import { WhatsappMessageMapper } from '../whatsapp-message.mapper';

/**
 * WhatsApp's two tables against a real Postgres, built by the migrations: a
 * number is read only by its owner, even by a workspace-wide reader; a host
 * holds one number; a message the host sends twice is one row, and a bot's
 * send that arrives after the host's own copy marks that row rather than
 * adding a twin; chats list newest first with their last message and the name
 * last seen; search takes `%` literally; retention deletes only what is old,
 * in batches; and the messages go with their number. For the owner: each of
 * their new messages is placed in its chat by the stored `/new`s and switches
 * (by `seq`, never by text or time) and stages its event once, however often
 * it is delivered; a deleted bot's switches stop counting; the bots' answers
 * to the owner are not counted as sends; and entering a code is a write
 * conditional on the code it was checked against, with wrong tries counted
 * in the row.
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
      entities: [WhatsappAccountOrmEntity, WhatsappMessageOrmEntity, OutboxMessageSchema],
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
      switchesToBotId: null,
      isReply: false,
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

  describe('the owner’s chat', () => {
    const OWNER = '34600999888@s.whatsapp.net';
    let mine: WhatsappAccountEntity;
    let defaultBot: string;
    let shop: string;

    async function insertBot(name: string): Promise<string> {
      const id = randomUUID();
      await dataSource.query(
        `INSERT INTO bot ("id", "organizationId", "name") VALUES ($1, $2, $3)`,
        [id, organizationId, name],
      );
      return id;
    }

    beforeEach(async () => {
      mine = number(ana);
      await accounts.insert(mine);
      defaultBot = await insertBot('Juno');
      shop = await insertBot('Shop');
    });

    const fromOwner = (text: string, overrides: Partial<WhatsappMessageDraft> = {}) =>
      message(mine, { chatId: OWNER, senderId: OWNER, chatName: 'Me', text, ...overrides });

    /** What intake owes the owner's messages: an event for each, carrying its place. */
    const owed: () => WhatsappMessagesOwed = () => ({
      answeringBotId: defaultBot,
      isOwners: (draft) => !draft.fromMe && draft.senderId === OWNER,
      eventFor: (stored, place) =>
        new WhatsappOwnerWroteDomainEvent({
          aggregateId: mine.id,
          organizationId,
          userId: ana,
          accountId: mine.id,
          chatId: stored.chatId,
          messageRowId: stored.id,
          seq: stored.seq,
          botId: place.botId ?? '',
          conversationStartsAt: place.startsAt,
          startsHere: place.startsAt === stored.seq,
          command: 'message',
          text: stored.text,
        }),
    });

    async function stagedFor(rowId: string): Promise<number> {
      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int AS count FROM outbox_message
          WHERE "aggregateId" = $1 AND payload->>'messageRowId' = $2`,
        [mine.id, rowId],
      );
      return count;
    }

    // What breaks this: a redelivered batch answered twice, or moving where a conversation starts.
    it('stores a batch delivered twice once, staging its event once and keeping its seq', async () => {
      const batch = [fromOwner('what sold?', { externalId: 'A1' })];
      const [first] = await messages.insertMany(batch, owed());
      const again = await messages.insertMany(batch, owed());

      expect(again).toEqual([]);
      expect(first?.place).toEqual({ botId: defaultBot, startsAt: '0' });
      expect(await stagedFor(first?.id ?? '')).toBe(1);
      const [{ seq }] = await dataSource.query(
        `SELECT seq::text AS seq FROM whatsapp_message WHERE id = $1`,
        [first?.id],
      );
      expect(seq).toBe(first?.seq);
    });

    // What breaks this: a conversation start or a switch lost between batches, or a stranger's /new counted.
    it('places each message after the later of the last /new and the last switch, with that switch’s bot', async () => {
      const [hello] = await messages.insertMany([fromOwner('hello')], owed());
      const [, , afterSwitch] = await messages.insertMany(
        [
          fromOwner('/new'),
          fromOwner('Shop: what sold?', { switchesToBotId: shop }),
          fromOwner('and yesterday?'),
        ],
        owed(),
      );
      const stranger = '34600333444@s.whatsapp.net';
      await messages.insertMany(
        [
          message(mine, { chatId: stranger, senderId: stranger, text: '/new' }),
          fromOwner('/new', { fromMe: true }),
        ],
        owed(),
      );
      const [later] = await messages.insertMany([fromOwner('anything else?')], owed());
      const [renewed] = await messages.insertMany([fromOwner('/NEW ')], owed());

      expect(hello?.place).toEqual({ botId: defaultBot, startsAt: '0' });
      const switchSeq = String(BigInt(afterSwitch?.seq ?? '0') - 1n);
      expect(afterSwitch?.place).toEqual({ botId: shop, startsAt: switchSeq });
      expect(later?.place).toEqual({ botId: shop, startsAt: switchSeq });
      expect(renewed?.place).toEqual({ botId: shop, startsAt: renewed?.seq });
      expect(await messages.findSwitchedBot({ organizationId, accountId: mine.id }, OWNER)).toBe(
        shop,
      );
    });

    // What breaks this: an owner in Brazil confirmed with the ninth digit while WhatsApp
    // writes their number without it, whose /new is answered but starts nothing.
    it('starts a conversation at the owner’s /new whichever form WhatsApp writes their number in', async () => {
      const written = '551187654321@s.whatsapp.net';
      const fromBrazil = (text: string) =>
        message(mine, { chatId: written, senderId: written, chatName: 'Me', text });
      const brazil = (): WhatsappMessagesOwed => ({
        ...owed(),
        isOwners: (draft) => !draft.fromMe && draft.chatId === written,
      });
      await messages.insertMany([fromBrazil('hello')], brazil());
      const [renewed, after] = await messages.insertMany(
        [fromBrazil('/new'), fromBrazil('fresh start')],
        brazil(),
      );

      expect(after?.place.startsAt).toBe(renewed?.seq);
    });

    // What breaks this: a "Name: …" for the bot already answering counted as a switch, so an
    // owner who prefixes every message gets a fresh conversation on each one.
    it('keeps one conversation while the owner names the bot that already answers', async () => {
      const [first] = await messages.insertMany(
        [fromOwner('Shop: what sold today?', { switchesToBotId: shop })],
        owed(),
      );
      const [again] = await messages.insertMany(
        [fromOwner('Shop: and yesterday?', { switchesToBotId: shop })],
        owed(),
      );
      const [juno] = await messages.insertMany(
        [fromOwner('Juno: hi', { switchesToBotId: defaultBot })],
        owed(),
      );
      const [junoAgain] = await messages.insertMany(
        [fromOwner('Juno: still you?', { switchesToBotId: defaultBot })],
        owed(),
      );
      const [back] = await messages.insertMany(
        [fromOwner('Shop: back', { switchesToBotId: shop })],
        owed(),
      );

      expect(first?.place).toEqual({ botId: shop, startsAt: first?.seq });
      expect(again?.place).toEqual({ botId: shop, startsAt: first?.seq });
      expect(juno?.place).toEqual({ botId: defaultBot, startsAt: juno?.seq });
      expect(junoAgain?.place).toEqual({ botId: defaultBot, startsAt: juno?.seq });
      expect(back?.place).toEqual({ botId: shop, startsAt: back?.seq });
    });

    // What breaks this: naming the number's default bot, with no other bot switched to, starting it afresh.
    it('keeps the default bot’s conversation when the owner names it', async () => {
      const [hello] = await messages.insertMany([fromOwner('hello')], owed());
      const [named] = await messages.insertMany(
        [fromOwner('Juno: more', { switchesToBotId: defaultBot })],
        owed(),
      );

      expect(hello?.place).toEqual({ botId: defaultBot, startsAt: '0' });
      expect(named?.place).toEqual({ botId: defaultBot, startsAt: '0' });
    });

    // What breaks this: FK_whatsapp_message_switches_to_bot not SET NULL, or the chat stuck on a deleted bot.
    it('forgets a deleted bot’s switches, so the chat falls back to the default', async () => {
      await messages.insertMany([fromOwner('Shop: hi', { switchesToBotId: shop })], owed());
      await dataSource.query(`DELETE FROM bot WHERE id = $1`, [shop]);
      const [next] = await messages.insertMany([fromOwner('still there?')], owed());

      expect(next?.place).toEqual({ botId: defaultBot, startsAt: '0' });
      expect(
        await messages.findSwitchedBot({ organizationId, accountId: mine.id }, OWNER),
      ).toBeNull();
    });

    // What breaks this: the owner's conversation using up the bots' 100 sends a day.
    it('counts a bot’s sends toward its day, but not its answers to the owner', async () => {
      const ref = { organizationId, accountId: mine.id };
      await messages.recordBotSend(
        message(mine, { externalId: 'S1', fromMe: true, sentByBotId: defaultBot }),
      );
      await messages.recordBotSend(
        message(mine, {
          externalId: 'R1',
          chatId: OWNER,
          fromMe: true,
          sentByBotId: defaultBot,
          isReply: true,
          quotedId: 'A1',
        }),
      );
      expect(await messages.countBotSendsSince(ref, new Date(Date.now() - 60_000))).toBe(1);
      expect((await messages.findInChat(ref, OWNER, 10, null))[0]?.quotedId).toBe('A1');
    });

    // What breaks this: a code entered against a replaced one confirming, or parallel guesses past five.
    it('confirms only against the waiting code, and counts every wrong try in the row', async () => {
      mine.report({ state: 'connected', phone: '34600111222@s.whatsapp.net' });
      await accounts.save(mine);
      const named = mine.nameOwner(OWNER, new Date());
      await accounts.saveOwnerCode(mine);
      const usedCodeHash = mine.ownerCodeHash ?? '';

      // A copy loaded before a new code was asked for loses.
      const stale = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
      mine.nameOwner(OWNER, new Date());
      await accounts.saveOwnerCode(mine);
      stale.confirmOwner(named?.code ?? '', new Date());
      expect(await accounts.saveOwner(stale, usedCodeHash)).toBe(false);
      expect((await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap().ownerPhone).toBeNull();

      // Five wrong tries at once all count, and lock the code.
      const current = mine.ownerCodeHash ?? '';
      const tries = await Promise.all(
        Array.from({ length: 6 }, async () => {
          const copy = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
          copy.confirmOwner('not-it', new Date());
          return accounts.saveOwner(copy, current);
        }),
      );
      expect(tries.filter(Boolean)).toHaveLength(5);
      const locked = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
      expect(locked.ownerCodeAttempts).toBe(5);
      expect(locked.ownerCodeHash).not.toBe(hashWhatsappOwnerCode('not-it'));
    });

    // What breaks this: two code requests overlap, the first one's send fails after the
    // second's was sent, and forgetting the first drops the code the owner just received.
    it('forgets a failed code only while it is still the one waiting', async () => {
      mine.nameOwner(OWNER, new Date());
      await accounts.saveOwnerCode(mine);
      const failed = mine.ownerCodeHash ?? '';
      const newer = (await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap();
      newer.nameOwner(OWNER, new Date());
      await accounts.saveOwnerCode(newer);
      const sent = newer.ownerCodeHash ?? '';

      mine.forgetOwnerCode();
      await accounts.saveOwnerCode(mine, failed);
      expect((await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap().ownerCodeHash).toBe(sent);

      // Its own failure does forget it.
      newer.forgetOwnerCode();
      await accounts.saveOwnerCode(newer, sent);
      expect((await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap().ownerCodeHash).toBeNull();
    });

    it('confirms the owner with the waiting code, clearing it', async () => {
      const named = mine.nameOwner(OWNER, new Date());
      await accounts.saveOwnerCode(mine);
      const usedCodeHash = mine.ownerCodeHash ?? '';
      expect(mine.confirmOwner(named?.code ?? '', new Date())).toBe('confirmed');
      expect(await accounts.saveOwner(mine, usedCodeHash)).toBe(true);
      expect((await accounts.findOwnById(scopeOf(ana), mine.id)).unwrap()).toMatchObject({
        ownerPhone: OWNER,
        ownerPendingPhone: null,
        ownerCodeHash: null,
        ownerCodeAttempts: 0,
      });
    });
  });
});
