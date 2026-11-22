import 'reflect-metadata';
import type { QueryBus } from '@nestjs/cqrs';
import type { AccessScope, ScopeResolverPort } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { WhatsappAnswerResolver } from '../application/whatsapp-answer.resolver';
import type { WhatsappDevicePort } from '../application/whatsapp-device.port';
import { WhatsappReplyResolver } from '../application/whatsapp-reply.resolver';
import { LinkWhatsappCommand } from '../commands/link-whatsapp/link-whatsapp.command';
import { LinkWhatsappCommandHandler } from '../commands/link-whatsapp/link-whatsapp.command-handler';
import { ReceiveWhatsappMessagesCommand } from '../commands/receive-whatsapp-messages/receive-whatsapp-messages.command';
import { ReceiveWhatsappMessagesCommandHandler } from '../commands/receive-whatsapp-messages/receive-whatsapp-messages.command-handler';
import { RecordWhatsappStateCommand } from '../commands/record-whatsapp-state/record-whatsapp-state.command';
import { RecordWhatsappStateCommandHandler } from '../commands/record-whatsapp-state/record-whatsapp-state.command-handler';
import { ReplyOnWhatsappCommand } from '../commands/reply-on-whatsapp/reply-on-whatsapp.command';
import { ReplyOnWhatsappCommandHandler } from '../commands/reply-on-whatsapp/reply-on-whatsapp.command-handler';
import { SendWhatsappMessageCommand } from '../commands/send-whatsapp-message/send-whatsapp-message.command';
import { SendWhatsappMessageCommandHandler } from '../commands/send-whatsapp-message/send-whatsapp-message.command-handler';
import { UpdateWhatsappAccountCommand } from '../commands/update-whatsapp-account/update-whatsapp-account.command';
import { UpdateWhatsappAccountCommandHandler } from '../commands/update-whatsapp-account/update-whatsapp-account.command-handler';
import type { WhatsappAccountRepositoryPort } from '../database/whatsapp-account.repository.port';
import type { WhatsappChatGrantRepositoryPort } from '../database/whatsapp-chat-grant.repository.port';
import type {
  WhatsappMessageRepositoryPort,
  WhatsappMessagesOwed,
} from '../database/whatsapp-message.repository.port';
import type { WhatsappContactWroteDomainEvent } from '../domain/events/whatsapp-contact-wrote.domain-event';
import type { WhatsappOwnerWroteDomainEvent } from '../domain/events/whatsapp-owner-wrote.domain-event';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import { WhatsappChatGrantEntity } from '../domain/whatsapp-chat-grant.entity';
import type { WhatsappMessageDraft, WhatsappStoredMessage } from '../domain/whatsapp-message.types';
import { WhatsappAccountMapper } from '../whatsapp-account.mapper';
import { WhatsappMessageMapper } from '../whatsapp-message.mapper';

/**
 * The rules the module's handlers hold: one device per host, a pairing only
 * where there is no device to keep, the account as the record of what a host
 * may hold, every message acknowledged once kept, and a bot's send only from
 * a connected number under its day's share, with the host's refusals told in
 * the module's own words.
 */

const ORG = '0b3e2a1c-1111-4c5d-8e6f-70819203b4c5';
const USER = '0b3e2a1c-2222-4c5d-8e6f-70819203b4c5';
const HOST = '0b3e2a1c-3333-4c5d-8e6f-70819203b4c5';

function scopeOf(userId = USER, organizationId: string | null = ORG): AccessScope {
  return { userId, organizationId, teamIds: [], grants: new Map(), bypass: false };
}

/** The accounts as rows in memory, owned the way the scoped repository owns them. */
function fakeAccounts(rows: WhatsappAccountEntity[] = []) {
  const repository: WhatsappAccountRepositoryPort = {
    findAllOwn: async (scope) =>
      rows.filter(
        (row) => row.userId === scope.userId && row.organizationId === scope.organizationId,
      ),
    findOwnById: async (scope, id) => {
      const row = rows.find(
        (item) =>
          item.id === id &&
          item.userId === scope.userId &&
          item.organizationId === scope.organizationId,
      );
      return row ? Some(row) : None;
    },
    findByHostForSystem: async (hostId) => {
      const row = rows.find((item) => item.hostId === hostId);
      return row ? Some(row) : None;
    },
    findByIdForSystem: async (organizationId, id) => {
      const row = rows.find((item) => item.id === id && item.organizationId === organizationId);
      return row ? Some(row) : None;
    },
    insert: vi.fn(async (account) => {
      rows.push(account);
    }),
    save: vi.fn(async () => {}),
    saveAnswering: vi.fn(async () => {}),
    saveOwnerCode: vi.fn(async () => {}),
    saveOwner: vi.fn(async () => true),
    delete: vi.fn(async (account) => {
      rows.splice(rows.indexOf(account), 1);
    }),
  };
  return { repository, rows };
}

function fakeDevice(overrides: Partial<WhatsappDevicePort> = {}): WhatsappDevicePort {
  return {
    reach: vi.fn().mockReturnValue('online'),
    link: vi.fn().mockReturnValue(true),
    unlink: vi.fn().mockReturnValue(true),
    send: vi.fn(),
    sendVoice: vi.fn(),
    voiceNote: vi.fn(),
    ...overrides,
  };
}

function fakeMessages(
  overrides: Partial<WhatsappMessageRepositoryPort> = {},
): WhatsappMessageRepositoryPort {
  return {
    insertMany: vi.fn(async () => []),
    recordBotSend: vi.fn(async () => {}),
    findById: vi.fn(async () => null),
    findSwitchedBot: vi.fn(async () => null),
    pruneBefore: vi.fn(async () => 0),
    pruneBeyond: vi.fn(async () => 0),
    findChats: vi.fn(async () => []),
    findInChat: vi.fn(async () => []),
    search: vi.fn(async () => []),
    countBotSendsSince: vi.fn(async () => 0),
    ...overrides,
  };
}

/** The owner's bots, as `FindBotsQuery` answers them. */
function bots(...named: Array<{ id: string; name: string }>) {
  return named.map((bot) => ({ ...bot, createdByUserId: USER }) as unknown as BotEntity);
}

/** The answering path over a query bus that lists `owned`, sending through `device`. */
function answersOf(
  messages: WhatsappMessageRepositoryPort,
  owned: BotEntity[] = [],
  device: WhatsappDevicePort = fakeDevice(),
  allowed: WhatsappChatGrantEntity[] = [],
) {
  const queryBus = { execute: vi.fn(async () => owned) } as unknown as QueryBus;
  const scopes = { resolve: vi.fn(async () => scopeOf()) } as unknown as ScopeResolverPort;
  return new WhatsappAnswerResolver(
    queryBus,
    scopes,
    new WhatsappReplyResolver(device, messages, new WhatsappMessageMapper()),
    fakeGrants(allowed),
  );
}

/** The chats a number allows, faked: read by chat or whole. */
function fakeGrants(allowed: WhatsappChatGrantEntity[] = []): WhatsappChatGrantRepositoryPort {
  return {
    findAll: vi.fn(async () => allowed),
    findByChat: vi.fn(async (_of, chatId: string) => {
      const grant = allowed.find((each) => each.chatId === chatId);
      return grant ? Some(grant) : None;
    }),
  } as unknown as WhatsappChatGrantRepositoryPort;
}

/** A chat the number allows, answered by `botId` (null: the number's default). */
function grant(
  chatId: string,
  chatKind: 'direct' | 'group',
  botId: string | null,
): WhatsappChatGrantEntity {
  return WhatsappChatGrantEntity.allow({
    organizationId: ORG,
    accountId: 'account',
    chatId,
    chatKind,
    chatName: chatKind === 'group' ? 'Family' : null,
    botId,
    grantedByBotId: null,
  });
}

const hosts: HostAccessPort = { assertUsable: vi.fn(async () => ({ probedTools: null })) };

function account(props: { userId?: string; status?: 'connected' | 'logged_out' } = {}) {
  const linked = WhatsappAccountEntity.link({
    organizationId: ORG,
    userId: props.userId ?? USER,
    hostId: HOST,
    label: 'Spare',
  });
  if (props.status) linked.report({ state: props.status, phone: '34600111222@s.whatsapp.net' });
  return linked;
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  return undefined;
}

describe('LinkWhatsappCommandHandler', () => {
  it('links a new number on the host and asks the runner to pair', async () => {
    const accounts = fakeAccounts();
    const device = fakeDevice();
    const handler = new LinkWhatsappCommandHandler(hosts, device, accounts.repository);

    const id = await handler.execute(
      new LinkWhatsappCommand({ scope: scopeOf(), hostId: HOST, label: 'Spare' }),
    );

    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]).toMatchObject({ id, status: 'pairing', label: 'Spare' });
    expect(device.link).toHaveBeenCalledWith(HOST);
  });

  it('pairs the caller’s logged-out number again, and leaves a connected one alone', async () => {
    const loggedOut = fakeAccounts([account({ status: 'logged_out' })]);
    const device = fakeDevice();
    await new LinkWhatsappCommandHandler(hosts, device, loggedOut.repository).execute(
      new LinkWhatsappCommand({ scope: scopeOf(), hostId: HOST }),
    );
    expect(loggedOut.rows[0]?.status).toBe('pairing');
    expect(device.link).toHaveBeenCalledTimes(1);

    const connected = fakeAccounts([account({ status: 'connected' })]);
    const quiet = fakeDevice();
    await new LinkWhatsappCommandHandler(hosts, quiet, connected.repository).execute(
      new LinkWhatsappCommand({ scope: scopeOf(), hostId: HOST }),
    );
    expect(connected.rows[0]?.status).toBe('connected');
    expect(quiet.link).not.toHaveBeenCalled();
  });

  it('refuses a host holding someone else’s number, an offline host and an older runner', async () => {
    const taken = fakeAccounts([account({ userId: 'someone-else' })]);
    expect(
      await codeOf(
        new LinkWhatsappCommandHandler(hosts, fakeDevice(), taken.repository).execute(
          new LinkWhatsappCommand({ scope: scopeOf(), hostId: HOST }),
        ),
      ),
    ).toBe('WHATSAPP_006');

    const offline = fakeDevice({ reach: vi.fn().mockReturnValue('offline') });
    expect(
      await codeOf(
        new LinkWhatsappCommandHandler(hosts, offline, fakeAccounts().repository).execute(
          new LinkWhatsappCommand({ scope: scopeOf(), hostId: HOST }),
        ),
      ),
    ).toBe('WHATSAPP_004');

    const older = fakeDevice({ reach: vi.fn().mockReturnValue('unsupported') });
    expect(
      await codeOf(
        new LinkWhatsappCommandHandler(hosts, older, fakeAccounts().repository).execute(
          new LinkWhatsappCommand({ scope: scopeOf(), hostId: HOST }),
        ),
      ),
    ).toBe('WHATSAPP_005');
  });
});

describe('RecordWhatsappStateCommandHandler', () => {
  it('keeps the host’s report on the number linked there', async () => {
    const accounts = fakeAccounts([account()]);
    const handler = new RecordWhatsappStateCommandHandler(
      accounts.repository,
      fakeDevice(),
      new WhatsappAccountMapper(),
    );
    await handler.execute(
      new RecordWhatsappStateCommand({
        hostId: HOST,
        report: {
          type: 'whatsapp.state',
          state: 'pairing',
          qr: '2@abc',
          qrExpiresAt: '2026-10-30T10:00:20Z',
        },
      }),
    );
    expect(accounts.rows[0]).toMatchObject({ status: 'pairing', qr: '2@abc' });
    expect(accounts.repository.save).toHaveBeenCalled();
  });

  it('unlinks a device the host holds for a number nobody links any more', async () => {
    const device = fakeDevice();
    const handler = new RecordWhatsappStateCommandHandler(
      fakeAccounts().repository,
      device,
      new WhatsappAccountMapper(),
    );
    await handler.execute(
      new RecordWhatsappStateCommand({
        hostId: HOST,
        report: { type: 'whatsapp.state', state: 'connected' },
      }),
    );
    await handler.execute(
      new RecordWhatsappStateCommand({
        hostId: HOST,
        report: { type: 'whatsapp.state', state: 'unlinked' },
      }),
    );
    expect(device.unlink).toHaveBeenCalledTimes(1);
  });
});

describe('ReceiveWhatsappMessagesCommandHandler', () => {
  const inbound = {
    key: '34600333444@s.whatsapp.net/3EB0',
    id: '3EB0',
    chatId: '34600333444@s.whatsapp.net',
    chatKind: 'direct' as const,
    senderId: '34600333444@s.whatsapp.net',
    senderName: 'Marta',
    fromMe: false,
    text: 'Are we still on for Tuesday?',
    sentAt: '2026-10-30T10:00:00Z',
  };

  it('keeps the messages for the number on the host, prunes old ones, and acks every key', async () => {
    const messages = fakeMessages();
    const linked = account();
    const handler = new ReceiveWhatsappMessagesCommandHandler(
      fakeAccounts([linked]).repository,
      messages,
      new WhatsappMessageMapper(),
      answersOf(messages),
    );

    const keys = await handler.execute(
      new ReceiveWhatsappMessagesCommand({ hostId: HOST, messages: [inbound] }),
    );

    expect(keys).toEqual([inbound.key]);
    expect(vi.mocked(messages.insertMany).mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        accountId: linked.id,
        externalId: '3EB0',
        senderName: 'Marta',
        sentByBotId: null,
      }),
    ]);
    expect(messages.pruneBefore).toHaveBeenCalledWith(
      { organizationId: ORG, accountId: linked.id },
      expect.any(Date),
      500,
    );
    expect(messages.pruneBeyond).toHaveBeenCalledWith(
      { organizationId: ORG, accountId: linked.id },
      50_000,
      500,
    );
  });

  it('acks and drops messages for a host with no linked number', async () => {
    const messages = fakeMessages();
    const handler = new ReceiveWhatsappMessagesCommandHandler(
      fakeAccounts().repository,
      messages,
      new WhatsappMessageMapper(),
      answersOf(messages),
    );
    await expect(
      handler.execute(new ReceiveWhatsappMessagesCommand({ hostId: HOST, messages: [inbound] })),
    ).resolves.toEqual([inbound.key]);
    expect(messages.insertMany).not.toHaveBeenCalled();
  });
});

describe('SendWhatsappMessageCommandHandler', () => {
  const chat = {
    chatId: '34600333444@s.whatsapp.net',
    chatKind: 'direct' as const,
    chatName: 'Marta',
  };
  const command = (accountId: string) =>
    new SendWhatsappMessageCommand({
      scope: scopeOf(),
      accountId,
      chat,
      text: 'Tuesday works.',
      botId: 'bot-1',
    });

  it('sends from a connected number and keeps the message as the bot’s', async () => {
    const linked = account({ status: 'connected' });
    const messages = fakeMessages();
    const device = fakeDevice({
      send: vi.fn(async () => ({ kind: 'sent' as const, id: '3EB1', sentAt: new Date() })),
    });
    const handler = new SendWhatsappMessageCommandHandler(
      fakeAccounts([linked]).repository,
      messages,
      device,
      new WhatsappMessageMapper(),
    );

    await expect(handler.execute(command(linked.id))).resolves.toBe('3EB1');
    expect(device.send).toHaveBeenCalledWith(HOST, chat.chatId, 'Tuesday works.');
    expect(vi.mocked(messages.recordBotSend).mock.calls[0]?.[0]).toMatchObject({
      externalId: '3EB1',
      fromMe: true,
      sentByBotId: 'bot-1',
    });
  });

  it('refuses a number that is not connected, past the day’s share, and the host’s own budget', async () => {
    const pairing = account();
    const device = fakeDevice();
    expect(
      await codeOf(
        new SendWhatsappMessageCommandHandler(
          fakeAccounts([pairing]).repository,
          fakeMessages(),
          device,
          new WhatsappMessageMapper(),
        ).execute(command(pairing.id)),
      ),
    ).toBe('WHATSAPP_007');

    const busy = account({ status: 'connected' });
    const full = fakeMessages({ countBotSendsSince: vi.fn(async () => 100) });
    expect(
      await codeOf(
        new SendWhatsappMessageCommandHandler(
          fakeAccounts([busy]).repository,
          full,
          device,
          new WhatsappMessageMapper(),
        ).execute(command(busy.id)),
      ),
    ).toBe('WHATSAPP_009');
    expect(device.send).not.toHaveBeenCalled();

    const budget = fakeDevice({
      send: vi.fn(async () => ({ kind: 'failed' as const, code: 'WA_004' })),
    });
    expect(
      await codeOf(
        new SendWhatsappMessageCommandHandler(
          fakeAccounts([busy]).repository,
          fakeMessages(),
          budget,
          new WhatsappMessageMapper(),
        ).execute(command(busy.id)),
      ),
    ).toBe('WHATSAPP_009');
  });

  describe('a voice note', () => {
    const audio = Buffer.from('OggS-spoken');
    const spoken = (accountId: string) =>
      new SendWhatsappMessageCommand({
        scope: scopeOf(),
        accountId,
        chat,
        text: 'Tuesday works.',
        botId: 'bot-1',
        voice: { audio, seconds: 3 },
      });

    // What breaks this: a voice note sent as a text, or kept with its audio, or
    // read back by the bot as "[audio]" it cannot tell it said.
    it('goes to the host as audio, never as text, and is kept as a voice note saying the text', async () => {
      const linked = account({ status: 'connected' });
      const messages = fakeMessages();
      const device = fakeDevice({
        sendVoice: vi.fn(async () => ({ kind: 'sent' as const, id: '3EB9', sentAt: new Date() })),
      });
      const handler = new SendWhatsappMessageCommandHandler(
        fakeAccounts([linked]).repository,
        messages,
        device,
        new WhatsappMessageMapper(),
      );

      await expect(handler.execute(spoken(linked.id))).resolves.toBe('3EB9');
      expect(device.sendVoice).toHaveBeenCalledWith(HOST, chat.chatId, audio, 3);
      expect(device.send).not.toHaveBeenCalled();
      expect(vi.mocked(messages.recordBotSend).mock.calls[0]?.[0]).toMatchObject({
        externalId: '3EB9',
        fromMe: true,
        sentByBotId: 'bot-1',
        text: '',
        media: 'audio',
        voiceSeconds: 3,
        transcript: 'Tuesday works.',
      });
    });

    // What breaks this: speaking getting round the day's share a text spends.
    it('spends the day’s share a text does, and is refused past it before reaching the host', async () => {
      const busy = account({ status: 'connected' });
      const device = fakeDevice();
      expect(
        await codeOf(
          new SendWhatsappMessageCommandHandler(
            fakeAccounts([busy]).repository,
            fakeMessages({ countBotSendsSince: vi.fn(async () => 100) }),
            device,
            new WhatsappMessageMapper(),
          ).execute(spoken(busy.id)),
        ),
      ).toBe('WHATSAPP_009');
      expect(device.sendVoice).not.toHaveBeenCalled();
    });

    it('says a runner too old to send voice notes is one to update, and keeps nothing', async () => {
      const linked = account({ status: 'connected' });
      const messages = fakeMessages();
      const refusal = await new SendWhatsappMessageCommandHandler(
        fakeAccounts([linked]).repository,
        messages,
        fakeDevice({ sendVoice: vi.fn(async () => ({ kind: 'not_supported' as const })) }),
        new WhatsappMessageMapper(),
      )
        .execute(spoken(linked.id))
        .catch((error) => error);
      expect(refusal).toMatchObject({ code: 'WHATSAPP_005' });
      expect(refusal.detail).toContain('voice notes');
      expect(messages.recordBotSend).not.toHaveBeenCalled();
    });

    it('answers audio the host would not send, and WhatsApp refusing it, as WHATSAPP_008, keeping nothing', async () => {
      const linked = account({ status: 'connected' });
      for (const code of ['WA_008', 'WA_006', 'WA_003']) {
        const messages = fakeMessages();
        const refusal = await new SendWhatsappMessageCommandHandler(
          fakeAccounts([linked]).repository,
          messages,
          fakeDevice({
            sendVoice: vi.fn(async () => ({ kind: 'failed' as const, code, detail: 'refused' })),
          }),
          new WhatsappMessageMapper(),
        )
          .execute(spoken(linked.id))
          .catch((error) => error);
        expect(refusal).toMatchObject({ code: 'WHATSAPP_008', extensions: { upstreamCode: code } });
        expect(messages.recordBotSend).not.toHaveBeenCalled();
      }
    });
  });

  it('treats someone else’s number as not linked', async () => {
    const theirs = account({ userId: 'someone-else', status: 'connected' });
    expect(
      await codeOf(
        new SendWhatsappMessageCommandHandler(
          fakeAccounts([theirs]).repository,
          fakeMessages(),
          fakeDevice(),
          new WhatsappMessageMapper(),
        ).execute(command(theirs.id)),
      ),
    ).toBe('WHATSAPP_001');
  });
});

describe('ReceiveWhatsappMessagesCommandHandler, the owner’s messages', () => {
  const OWNER = '34600999888@s.whatsapp.net';
  const DEFAULT_BOT = 'bot-default';
  const SHOP = { id: 'bot-shop', name: 'Shop' };

  function owned() {
    const linked = account({ status: 'connected' });
    const named = linked.nameOwner(OWNER, new Date());
    linked.confirmOwner(named?.code ?? '', new Date());
    linked.answerAs(DEFAULT_BOT);
    return linked;
  }

  const fromOwner = (id: string, text: string) => ({
    key: `${OWNER}/${id}`,
    id,
    chatId: OWNER,
    chatKind: 'direct' as const,
    senderId: OWNER,
    fromMe: false,
    text,
    sentAt: '2026-11-09T10:00:00Z',
  });

  /**
   * The store, faked: each new message gets a row and a seq, and the owner's
   * are placed as the stored switches would place them (the SQL itself is
   * `whatsapp.integration.spec.ts`'s); the events staged are kept.
   */
  function storing() {
    const staged: WhatsappOwnerWroteDomainEvent[] = [];
    const messages = fakeMessages({
      insertMany: vi.fn(
        async (drafts: readonly WhatsappMessageDraft[], owed?: WhatsappMessagesOwed) =>
          drafts.map((draft, index) => {
            const seq = String(index + 1);
            const place =
              owed?.isOwners(draft) === true
                ? {
                    botId: draft.switchesToBotId ?? owed.answeringBotId,
                    startsAt: draft.switchesToBotId ? seq : '0',
                  }
                : null;
            const stored: WhatsappStoredMessage = { ...draft, id: `row-${seq}`, seq, place };
            const event = place ? owed?.eventFor(stored, place) : null;
            if (event) staged.push(event as WhatsappOwnerWroteDomainEvent);
            return stored;
          }),
      ),
    });
    return { messages, staged };
  }

  async function receive(owners: BotEntity[], ...texts: string[]) {
    const { messages, staged } = storing();
    const device = fakeDevice({
      send: vi.fn(async () => ({ kind: 'sent' as const, id: 'out', sentAt: new Date() })),
    });
    const answers = answersOf(messages, owners, device);
    await new ReceiveWhatsappMessagesCommandHandler(
      fakeAccounts([owned()]).repository,
      messages,
      new WhatsappMessageMapper(),
      answers,
    ).execute(
      new ReceiveWhatsappMessagesCommand({
        hostId: HOST,
        messages: texts.map((text, index) => fromOwner(`M${index}`, text)),
      }),
    );
    const drafts = vi.mocked(messages.insertMany).mock.calls[0]?.[0] ?? [];
    return { staged, drafts, device };
  }

  // What breaks this: the owner's message never waking a bot, or "Shop:" reaching the default.
  it('stages one event per message, for the bot a "Name:" switched to, without the prefix', async () => {
    const { staged, drafts } = await receive(bots(SHOP), 'Shop: what sold?', 'and yesterday?');
    expect(drafts[0]?.switchesToBotId).toBe(SHOP.id);
    expect(staged.map((event) => [event.botId, event.text, event.startsHere])).toEqual([
      [SHOP.id, 'what sold?', true],
      [DEFAULT_BOT, 'and yesterday?', false],
    ]);
  });

  // What breaks this: "Note: …" or "Re: …" eaten as a switch to nobody.
  it('keeps a "Name:" that names no bot as an ordinary message, prefix and all', async () => {
    const { staged, drafts } = await receive(bots(SHOP), 'Note: buy milk');
    expect(drafts[0]?.switchesToBotId).toBeNull();
    expect(staged[0]).toMatchObject({ botId: DEFAULT_BOT, text: 'Note: buy milk' });
  });

  // What breaks this: an ambiguous name silently picking one of two bots.
  it('switches to neither of two bots that share the name', async () => {
    const { staged, drafts } = await receive(
      bots(SHOP, { id: 'bot-shop-2', name: 'shop' }),
      'Shop: what sold?',
    );
    expect(drafts[0]?.switchesToBotId).toBeNull();
    expect(staged[0]).toMatchObject({ botId: DEFAULT_BOT, text: 'Shop: what sold?' });
  });

  it('answers a bare "Name:" with who the chat talks to now, and wakes nobody', async () => {
    const { staged, drafts, device } = await receive(bots(SHOP), 'Shop:');
    expect(drafts[0]?.switchesToBotId).toBe(SHOP.id);
    expect(staged).toEqual([]);
    // The fixed line goes out after intake, unawaited.
    await vi.waitFor(() =>
      expect(device.send).toHaveBeenCalledWith(HOST, OWNER, 'Now talking to Shop.', {
        id: 'M0',
        senderId: OWNER,
      }),
    );
  });
});

describe('ReceiveWhatsappMessagesCommandHandler, the chats a number allows', () => {
  const OWNER = '34600999888@s.whatsapp.net';
  const NUMBER = '34611000000@s.whatsapp.net';
  const GROUP = '120363000000000001@g.us';
  const MARTA = '34600111333@s.whatsapp.net';

  function owned(defaultBot: string | null) {
    const linked = account({ status: 'connected' });
    linked.report({ state: 'connected', phone: NUMBER });
    const named = linked.nameOwner(OWNER, new Date());
    linked.confirmOwner(named?.code ?? '', new Date());
    linked.answerAs(defaultBot);
    return linked;
  }

  const inbound = (
    id: string,
    chatId: string,
    overrides: Partial<ReceiveWhatsappMessagesCommand['messages'][number]> = {},
  ) => ({
    key: `${chatId}/${id}`,
    id,
    chatId,
    chatKind: chatId.endsWith('@g.us') ? ('group' as const) : ('direct' as const),
    chatName: chatId.endsWith('@g.us') ? 'Family' : undefined,
    senderId: MARTA,
    senderName: 'Marta',
    fromMe: false,
    text: `message ${id}`,
    sentAt: '2026-11-20T10:00:00Z',
    ...overrides,
  });

  async function receive(
    defaultBot: string | null,
    allowed: WhatsappChatGrantEntity[],
    ...messages: ReturnType<typeof inbound>[]
  ) {
    const staged: unknown[] = [];
    const store = fakeMessages({
      insertMany: vi.fn(
        async (drafts: readonly WhatsappMessageDraft[], owed?: WhatsappMessagesOwed) =>
          drafts.map((draft, index) => {
            const stored: WhatsappStoredMessage = {
              ...draft,
              id: `row-${index + 1}`,
              seq: String(index + 1),
              place: null,
            };
            const event = owed?.contactEventFor?.(stored);
            if (event) staged.push(event);
            return stored;
          }),
      ),
    });
    await new ReceiveWhatsappMessagesCommandHandler(
      fakeAccounts([owned(defaultBot)]).repository,
      store,
      new WhatsappMessageMapper(),
      answersOf(store, [], fakeDevice(), allowed),
    ).execute(new ReceiveWhatsappMessagesCommand({ hostId: HOST, messages }));
    return staged as WhatsappContactWroteDomainEvent[];
  }

  // What breaks this: the family group's bot left silent on a line that does
  // not mention the number; a person the owner allowed unanswered.
  it('wakes the chat’s bot on every message of an allowed group, and of an allowed person', async () => {
    const staged = await receive(
      'bot-default',
      [grant(GROUP, 'group', 'bot-family'), grant(MARTA, 'direct', null)],
      inbound('G1', GROUP),
      inbound('G2', GROUP, { mentions: [NUMBER], text: '@Juno dinner at 8?' }),
      inbound('D1', MARTA, { text: 'Hi Juno' }),
    );
    expect(staged.map((event) => [event.chatId, event.botId, event.text, event.chatKind])).toEqual([
      [GROUP, 'bot-family', 'message G1', 'group'],
      [GROUP, 'bot-family', '@Juno dinner at 8?', 'group'],
      [MARTA, 'bot-default', 'Hi Juno', 'direct'],
    ]);
    expect(staged[0]).toMatchObject({ senderId: MARTA, senderName: 'Marta', chatName: 'Family' });
  });

  // What breaks this: "don't answer" in Settings still answering, or a chat
  // the owner never allowed reaching a bot.
  it('wakes no one in a chat with no bot and no default, or in a chat it does not allow', async () => {
    const silent = await receive(null, [grant(MARTA, 'direct', null)], inbound('D1', MARTA));
    expect(silent).toEqual([]);
    const stranger = await receive(
      'bot-default',
      [],
      inbound('D1', '34655000000@s.whatsapp.net', { senderId: '34655000000@s.whatsapp.net' }),
    );
    expect(stranger).toEqual([]);
  });
});

describe('ReplyOnWhatsappCommandHandler', () => {
  const OWNER = '34600999888@s.whatsapp.net';
  const BOT = 'bot-1';

  function owned(status: 'connected' | 'logged_out' = 'connected') {
    const linked = account({ status: 'connected' });
    const named = linked.nameOwner(OWNER, new Date());
    linked.confirmOwner(named?.code ?? '', new Date());
    linked.answerAs(BOT);
    if (status !== 'connected') linked.report({ state: status });
    return linked;
  }

  function reply(
    linked: WhatsappAccountEntity,
    overrides: Partial<WhatsappMessageRepositoryPort> = {},
    allowed: WhatsappChatGrantEntity[] = [],
  ) {
    const device = fakeDevice({
      send: vi.fn(async () => ({ kind: 'sent' as const, id: 'out', sentAt: new Date() })),
    });
    const messages = fakeMessages({
      findById: vi.fn(async () => ({ externalId: '3EB0', senderId: OWNER }) as never),
      ...overrides,
    });
    const handler = new ReplyOnWhatsappCommandHandler(
      fakeAccounts([linked]).repository,
      messages,
      fakeGrants(allowed),
      new WhatsappReplyResolver(device, messages, new WhatsappMessageMapper()),
    );
    const run = (text: string, botId = BOT, chatId = OWNER) =>
      handler.execute(
        new ReplyOnWhatsappCommand({
          organizationId: ORG,
          accountId: linked.id,
          chatId,
          replyToRowId: '0b3e2a1c-9999-4c5d-8e6f-70819203b4c5',
          text,
          botId,
        }),
      );
    return { device, messages, run };
  }

  // What breaks this: an unquoted answer, or every part of a long one quoting.
  it('quotes the owner’s message on the first part only, and records the parts as replies', async () => {
    const { device, messages, run } = reply(owned());
    await expect(run(`${'a'.repeat(7_000)}\n\n${'b'.repeat(2_000)}`)).resolves.toBe(2);
    const calls = vi.mocked(device.send).mock.calls;
    expect(calls[0]?.[3]).toEqual({ id: '3EB0', senderId: OWNER });
    expect(calls[1]?.[3]).toBeUndefined();
    expect(vi.mocked(messages.recordBotSend).mock.calls[0]?.[0]).toMatchObject({
      sentByBotId: BOT,
      isReply: true,
      quotedId: '3EB0',
    });
  });

  // What breaks this: an answer delivered after the owner switched, re-defaulted or unlinked.
  it('sends nothing once the bot no longer answers the chat or the number is not connected', async () => {
    const switched = reply(owned(), { findSwitchedBot: vi.fn(async () => 'bot-shop') });
    await expect(switched.run('hello')).resolves.toBe(0);
    expect(switched.device.send).not.toHaveBeenCalled();

    const shop = reply(owned(), { findSwitchedBot: vi.fn(async () => 'bot-shop') });
    await expect(shop.run('hello', 'bot-shop')).resolves.toBe(1);

    const offline = reply(owned('logged_out'));
    await expect(offline.run('hello')).resolves.toBe(0);
    expect(offline.device.send).not.toHaveBeenCalled();
  });

  // What breaks this: a bot answering in a chat no longer allowed, or in one
  // another bot answers; or a group's answer kept as a direct chat's.
  it('answers a chat the number allows with that chat’s bot, else the default, and nowhere else', async () => {
    const GROUP = '120363000000000001@g.us';
    const MARTA = '34600111333@s.whatsapp.net';
    const allowed = [grant(GROUP, 'group', 'bot-family'), grant(MARTA, 'direct', null)];

    const family = reply(owned(), {}, allowed);
    await expect(family.run('Dinner at 8.', 'bot-family', GROUP)).resolves.toBe(1);
    expect(vi.mocked(family.messages.recordBotSend).mock.calls[0]?.[0]).toMatchObject({
      chatId: GROUP,
      chatKind: 'group',
      chatName: 'Family',
    });
    await expect(family.run('Dinner at 8.', BOT, GROUP)).resolves.toBe(0);

    const marta = reply(owned(), {}, allowed);
    await expect(marta.run('Hi Marta', BOT, MARTA)).resolves.toBe(1);

    const stranger = reply(owned(), {}, allowed);
    await expect(stranger.run('Hi', BOT, '34699000000@s.whatsapp.net')).resolves.toBe(0);
    expect(stranger.device.send).not.toHaveBeenCalled();
  });
});

describe('UpdateWhatsappAccountCommandHandler', () => {
  // What breaks this: someone else's bot answering on the caller's number.
  it('chooses the caller’s own bot, and refuses one the bots module does not find for them with BOTS_001', async () => {
    const linked = account({ status: 'connected' });
    const accounts = fakeAccounts([linked]);
    const found = { execute: vi.fn(async () => ({})) } as unknown as QueryBus;
    await new UpdateWhatsappAccountCommandHandler(accounts.repository, found).execute(
      new UpdateWhatsappAccountCommand({
        scope: scopeOf(),
        accountId: linked.id,
        answeringBotId: 'bot-1',
      }),
    );
    expect(linked.answeringBotId).toBe('bot-1');
    expect(accounts.repository.saveAnswering).toHaveBeenCalledTimes(1);

    const notTheirs = {
      execute: vi.fn(async () => {
        throw new AppError({ code: 'BOTS_001', message: 'Bot not found', httpStatus: 404 });
      }),
    } as unknown as QueryBus;
    expect(
      await codeOf(
        new UpdateWhatsappAccountCommandHandler(accounts.repository, notTheirs).execute(
          new UpdateWhatsappAccountCommand({
            scope: scopeOf(),
            accountId: linked.id,
            answeringBotId: 'bot-2',
          }),
        ),
      ),
    ).toBe('BOTS_001');
    expect(linked.answeringBotId).toBe('bot-1');
    expect(accounts.repository.saveAnswering).toHaveBeenCalledTimes(1);
  });
});
