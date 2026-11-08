import 'reflect-metadata';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import type { TelegramDevicePort } from '../application/telegram-device.port';
import { LinkTelegramCommand } from '../commands/link-telegram/link-telegram.command';
import { LinkTelegramCommandHandler } from '../commands/link-telegram/link-telegram.command-handler';
import { ReceiveTelegramMessagesCommand } from '../commands/receive-telegram-messages/receive-telegram-messages.command';
import { ReceiveTelegramMessagesCommandHandler } from '../commands/receive-telegram-messages/receive-telegram-messages.command-handler';
import { RecordTelegramStateCommand } from '../commands/record-telegram-state/record-telegram-state.command';
import { RecordTelegramStateCommandHandler } from '../commands/record-telegram-state/record-telegram-state.command-handler';
import { SendTelegramMessageCommand } from '../commands/send-telegram-message/send-telegram-message.command';
import { SendTelegramMessageCommandHandler } from '../commands/send-telegram-message/send-telegram-message.command-handler';
import type { TelegramAccountRepositoryPort } from '../database/telegram-account.repository.port';
import type { TelegramMessageRepositoryPort } from '../database/telegram-message.repository.port';
import { TelegramAccountEntity } from '../domain/telegram-account.entity';
import { TelegramAccountMapper } from '../telegram-account.mapper';
import { TelegramMessageMapper } from '../telegram-message.mapper';

/**
 * The rules the module's handlers hold: one Telegram bot per host, the token
 * handed to the host and nowhere else, a refused token shown on the account,
 * the account as the record of what a host may hold, every message
 * acknowledged once kept, and a bot's send only through a connected Telegram
 * bot under its day's share, with the host's refusals told in the module's
 * own words.
 */

const ORG = '0b3e2a1c-1111-4c5d-8e6f-70819203b4c5';
const USER = '0b3e2a1c-2222-4c5d-8e6f-70819203b4c5';
const HOST = '0b3e2a1c-3333-4c5d-8e6f-70819203b4c5';

function scopeOf(userId = USER, organizationId: string | null = ORG): AccessScope {
  return { userId, organizationId, teamIds: [], grants: new Map(), bypass: false };
}

/** The accounts as rows in memory, owned the way the scoped repository owns them. */
function fakeAccounts(rows: TelegramAccountEntity[] = []) {
  const repository: TelegramAccountRepositoryPort = {
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
    insert: vi.fn(async (account) => {
      rows.push(account);
    }),
    save: vi.fn(async () => {}),
    delete: vi.fn(async (account) => {
      rows.splice(rows.indexOf(account), 1);
    }),
  };
  return { repository, rows };
}

function fakeDevice(overrides: Partial<TelegramDevicePort> = {}): TelegramDevicePort {
  return {
    reach: vi.fn().mockReturnValue('online'),
    link: vi.fn().mockReturnValue({ sent: true, refused: Promise.resolve(null) }),
    unlink: vi.fn().mockReturnValue(true),
    send: vi.fn(),
    ...overrides,
  };
}

function fakeMessages(
  overrides: Partial<TelegramMessageRepositoryPort> = {},
): TelegramMessageRepositoryPort {
  return {
    insertMany: vi.fn(async () => {}),
    recordBotSend: vi.fn(async () => {}),
    pruneBefore: vi.fn(async () => 0),
    pruneBeyond: vi.fn(async () => 0),
    findChats: vi.fn(async () => []),
    findInChat: vi.fn(async () => []),
    search: vi.fn(async () => []),
    countBotSendsSince: vi.fn(async () => 0),
    ...overrides,
  };
}

const hosts: HostAccessPort = { assertUsable: vi.fn(async () => ({ probedTools: null })) };

const TOKEN = '7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';

function account(props: { userId?: string; status?: 'connected' | 'revoked' } = {}) {
  const linked = TelegramAccountEntity.link({
    organizationId: ORG,
    userId: props.userId ?? USER,
    hostId: HOST,
    label: 'Shop',
  });
  if (props.status) {
    linked.report({ state: props.status, botId: '7012345678', username: 'shop_helper_bot' });
  }
  return linked;
}

const link = (scope = scopeOf()) =>
  new LinkTelegramCommand({ scope, hostId: HOST, token: TOKEN, label: 'Shop' });

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  return undefined;
}

describe('LinkTelegramCommandHandler', () => {
  it('connects a new Telegram bot on the host and hands the runner its token', async () => {
    const accounts = fakeAccounts();
    const device = fakeDevice();
    const handler = new LinkTelegramCommandHandler(hosts, device, accounts.repository);

    const id = await handler.execute(link());

    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]).toMatchObject({ id, status: 'connecting', label: 'Shop' });
    expect(device.link).toHaveBeenCalledWith(HOST, TOKEN);
    // The token is the host's: nothing the control plane keeps carries it.
    expect(JSON.stringify(vi.mocked(accounts.repository.insert).mock.calls)).not.toContain(
      TOKEN.split(':')[1],
    );
  });

  it('hands the caller’s revoked bot a new token, keeping its row', async () => {
    const revoked = fakeAccounts([account({ status: 'revoked' })]);
    const device = fakeDevice();
    await new LinkTelegramCommandHandler(hosts, device, revoked.repository).execute(link());
    expect(revoked.rows).toHaveLength(1);
    expect(revoked.rows[0]?.status).toBe('connecting');
    expect(device.link).toHaveBeenCalledTimes(1);
  });

  it('marks the account revoked when the host refuses the token', async () => {
    const accounts = fakeAccounts();
    let refuse: (value: { code: string } | null) => void = () => {};
    const device = fakeDevice({
      link: vi.fn().mockReturnValue({
        sent: true,
        refused: new Promise((resolve) => {
          refuse = resolve;
        }),
      }),
    });
    await new LinkTelegramCommandHandler(hosts, device, accounts.repository).execute(link());
    expect(accounts.rows[0]?.status).toBe('connecting');

    refuse({ code: 'TG_001' });
    await vi.waitFor(() => expect(accounts.rows[0]?.status).toBe('revoked'));
    expect(accounts.rows[0]?.statusReason).toBe('Telegram refused that token');
  });

  it('refuses a host holding someone else’s bot, an offline host and an older runner', async () => {
    const taken = fakeAccounts([account({ userId: 'someone-else' })]);
    expect(
      await codeOf(
        new LinkTelegramCommandHandler(hosts, fakeDevice(), taken.repository).execute(link()),
      ),
    ).toBe('TELEGRAM_006');

    const offline = fakeDevice({ reach: vi.fn().mockReturnValue('offline') });
    expect(
      await codeOf(
        new LinkTelegramCommandHandler(hosts, offline, fakeAccounts().repository).execute(link()),
      ),
    ).toBe('TELEGRAM_004');

    const older = fakeDevice({ reach: vi.fn().mockReturnValue('unsupported') });
    expect(
      await codeOf(
        new LinkTelegramCommandHandler(hosts, older, fakeAccounts().repository).execute(link()),
      ),
    ).toBe('TELEGRAM_005');
  });
});

describe('RecordTelegramStateCommandHandler', () => {
  it('keeps the host’s report on the Telegram bot connected there', async () => {
    const accounts = fakeAccounts([account()]);
    const handler = new RecordTelegramStateCommandHandler(
      accounts.repository,
      fakeDevice(),
      new TelegramAccountMapper(),
    );
    await handler.execute(
      new RecordTelegramStateCommand({
        hostId: HOST,
        report: {
          type: 'telegram.state',
          state: 'connected',
          botId: '7012345678',
          username: 'shop_helper_bot',
        },
      }),
    );
    expect(accounts.rows[0]).toMatchObject({ status: 'connected', username: 'shop_helper_bot' });
    expect(accounts.repository.save).toHaveBeenCalled();
  });

  it('unlinks a bot the host holds that nobody connects any more', async () => {
    const device = fakeDevice();
    const handler = new RecordTelegramStateCommandHandler(
      fakeAccounts().repository,
      device,
      new TelegramAccountMapper(),
    );
    await handler.execute(
      new RecordTelegramStateCommand({
        hostId: HOST,
        report: { type: 'telegram.state', state: 'connected' },
      }),
    );
    await handler.execute(
      new RecordTelegramStateCommand({
        hostId: HOST,
        report: { type: 'telegram.state', state: 'unlinked' },
      }),
    );
    expect(device.unlink).toHaveBeenCalledTimes(1);
  });
});

describe('ReceiveTelegramMessagesCommandHandler', () => {
  const inbound = {
    key: '123456789/42',
    id: '42',
    chatId: '123456789',
    chatKind: 'direct' as const,
    senderId: '123456789',
    senderName: 'Marta',
    senderUsername: 'martav',
    text: 'Is the build green?',
    sentAt: '2026-10-30T10:00:00Z',
  };

  it('keeps the messages for the Telegram bot on the host, prunes old ones, and acks every key', async () => {
    const messages = fakeMessages();
    const linked = account();
    const handler = new ReceiveTelegramMessagesCommandHandler(
      fakeAccounts([linked]).repository,
      messages,
      new TelegramMessageMapper(),
    );

    const keys = await handler.execute(
      new ReceiveTelegramMessagesCommand({ hostId: HOST, messages: [inbound] }),
    );

    expect(keys).toEqual([inbound.key]);
    expect(vi.mocked(messages.insertMany).mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        accountId: linked.id,
        externalId: '42',
        senderUsername: 'martav',
        fromBot: false,
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

  it('acks and drops messages for a host with no connected Telegram bot', async () => {
    const messages = fakeMessages();
    const handler = new ReceiveTelegramMessagesCommandHandler(
      fakeAccounts().repository,
      messages,
      new TelegramMessageMapper(),
    );
    await expect(
      handler.execute(new ReceiveTelegramMessagesCommand({ hostId: HOST, messages: [inbound] })),
    ).resolves.toEqual([inbound.key]);
    expect(messages.insertMany).not.toHaveBeenCalled();
  });
});

describe('SendTelegramMessageCommandHandler', () => {
  const chat = {
    chatId: '123456789',
    chatKind: 'direct' as const,
    chatName: 'Marta',
  };
  const command = (accountId: string) =>
    new SendTelegramMessageCommand({
      scope: scopeOf(),
      accountId,
      chat,
      text: 'Green since 10:12.',
      replyToId: '42',
      botId: 'bot-1',
    });

  it('sends through a connected Telegram bot and keeps the message as the bot’s', async () => {
    const linked = account({ status: 'connected' });
    const messages = fakeMessages();
    const device = fakeDevice({
      send: vi.fn(async () => ({ kind: 'sent' as const, id: '43', sentAt: new Date() })),
    });
    const handler = new SendTelegramMessageCommandHandler(
      fakeAccounts([linked]).repository,
      messages,
      device,
      new TelegramMessageMapper(),
    );

    await expect(handler.execute(command(linked.id))).resolves.toBe('43');
    expect(device.send).toHaveBeenCalledWith(HOST, chat.chatId, 'Green since 10:12.', '42');
    expect(vi.mocked(messages.recordBotSend).mock.calls[0]?.[0]).toMatchObject({
      externalId: '43',
      fromBot: true,
      replyToId: '42',
      sentByBotId: 'bot-1',
    });
  });

  it('refuses a Telegram bot that is not connected, past the day’s share, and the host saying it is not polling', async () => {
    const revoked = account({ status: 'revoked' });
    const device = fakeDevice();
    expect(
      await codeOf(
        new SendTelegramMessageCommandHandler(
          fakeAccounts([revoked]).repository,
          fakeMessages(),
          device,
          new TelegramMessageMapper(),
        ).execute(command(revoked.id)),
      ),
    ).toBe('TELEGRAM_007');

    const busy = account({ status: 'connected' });
    const full = fakeMessages({ countBotSendsSince: vi.fn(async () => 200) });
    expect(
      await codeOf(
        new SendTelegramMessageCommandHandler(
          fakeAccounts([busy]).repository,
          full,
          device,
          new TelegramMessageMapper(),
        ).execute(command(busy.id)),
      ),
    ).toBe('TELEGRAM_009');
    expect(device.send).not.toHaveBeenCalled();

    const budget = fakeDevice({
      send: vi.fn(async () => ({ kind: 'failed' as const, code: 'TG_003' })),
    });
    expect(
      await codeOf(
        new SendTelegramMessageCommandHandler(
          fakeAccounts([busy]).repository,
          fakeMessages(),
          budget,
          new TelegramMessageMapper(),
        ).execute(command(busy.id)),
      ),
    ).toBe('TELEGRAM_007');
  });

  it('treats someone else’s Telegram bot as not connected', async () => {
    const theirs = account({ userId: 'someone-else', status: 'connected' });
    expect(
      await codeOf(
        new SendTelegramMessageCommandHandler(
          fakeAccounts([theirs]).repository,
          fakeMessages(),
          fakeDevice(),
          new TelegramMessageMapper(),
        ).execute(command(theirs.id)),
      ),
    ).toBe('TELEGRAM_001');
  });
});
