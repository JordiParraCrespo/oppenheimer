import 'reflect-metadata';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import type { WhatsappDevicePort } from '../application/whatsapp-device.port';
import { LinkWhatsappCommand } from '../commands/link-whatsapp/link-whatsapp.command';
import { LinkWhatsappCommandHandler } from '../commands/link-whatsapp/link-whatsapp.command-handler';
import { ReceiveWhatsappMessagesCommand } from '../commands/receive-whatsapp-messages/receive-whatsapp-messages.command';
import { ReceiveWhatsappMessagesCommandHandler } from '../commands/receive-whatsapp-messages/receive-whatsapp-messages.command-handler';
import { RecordWhatsappStateCommand } from '../commands/record-whatsapp-state/record-whatsapp-state.command';
import { RecordWhatsappStateCommandHandler } from '../commands/record-whatsapp-state/record-whatsapp-state.command-handler';
import { SendWhatsappMessageCommand } from '../commands/send-whatsapp-message/send-whatsapp-message.command';
import { SendWhatsappMessageCommandHandler } from '../commands/send-whatsapp-message/send-whatsapp-message.command-handler';
import type { WhatsappAccountRepositoryPort } from '../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../database/whatsapp-message.repository.port';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
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

function fakeDevice(overrides: Partial<WhatsappDevicePort> = {}): WhatsappDevicePort {
  return {
    reach: vi.fn().mockReturnValue('online'),
    link: vi.fn().mockReturnValue(true),
    unlink: vi.fn().mockReturnValue(true),
    send: vi.fn(),
    ...overrides,
  };
}

function fakeMessages(
  overrides: Partial<WhatsappMessageRepositoryPort> = {},
): WhatsappMessageRepositoryPort {
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
