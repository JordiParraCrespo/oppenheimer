import 'reflect-metadata';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { WhatsappDevicePort } from '../application/whatsapp-device.port';
import { ConfirmWhatsappOwnerCommand } from '../commands/confirm-whatsapp-owner/confirm-whatsapp-owner.command';
import { ConfirmWhatsappOwnerCommandHandler } from '../commands/confirm-whatsapp-owner/confirm-whatsapp-owner.command-handler';
import { RequestWhatsappOwnerCommand } from '../commands/request-whatsapp-owner/request-whatsapp-owner.command';
import { RequestWhatsappOwnerCommandHandler } from '../commands/request-whatsapp-owner/request-whatsapp-owner.command-handler';
import type { WhatsappAccountRepositoryPort } from '../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../database/whatsapp-message.repository.port';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import {
  hashWhatsappOwnerCode,
  WHATSAPP_OWNER_CODE_TTL_MS,
} from '../domain/whatsapp-owner-code.policy';
import { WhatsappMessageMapper } from '../whatsapp-message.mapper';

/**
 * Whose number a linked number answers
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1): the owner
 * names their own number, the linked number sends it a six-digit code, and
 * the code entered in Settings, in time and within five tries, confirms it.
 * Only the code's hash is kept, and a code entered against a replaced one
 * changes nothing. The conditional write itself is proven against Postgres
 * in `whatsapp.integration.spec.ts`.
 */

const ORG = '0b3e2a1c-1111-4c5d-8e6f-70819203b4c5';
const USER = '0b3e2a1c-2222-4c5d-8e6f-70819203b4c5';
const SPARE = '34600111222@s.whatsapp.net';
const MINE = '34600999888@s.whatsapp.net';
const NOW = new Date('2026-11-09T10:00:00Z');

const scope: AccessScope = {
  userId: USER,
  organizationId: ORG,
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function connected(): WhatsappAccountEntity {
  const account = WhatsappAccountEntity.link({
    organizationId: ORG,
    userId: USER,
    hostId: 'host',
    label: 'Spare',
  });
  account.report({ state: 'connected', phone: SPARE });
  return account;
}

/** The account as its row: each owner write is what the repository writes, the confirm conditional on the hash. */
function fakeAccounts(account: WhatsappAccountEntity) {
  const row = {
    ownerPhone: account.ownerPhone,
    ownerCodeHash: account.ownerCodeHash,
    attempts: account.ownerCodeAttempts,
  };
  const repository: Pick<
    WhatsappAccountRepositoryPort,
    'findOwnById' | 'saveOwnerCode' | 'saveOwner'
  > = {
    findOwnById: async (_scope, id) => (id === account.id ? Some(account) : None),
    saveOwnerCode: vi.fn(async (saved) => {
      row.ownerCodeHash = saved.ownerCodeHash;
      row.attempts = saved.ownerCodeAttempts;
    }),
    saveOwner: vi.fn(async (saved, usedCodeHash) => {
      if (row.ownerCodeHash !== usedCodeHash || row.attempts >= 5) return false;
      if (saved.ownerCodeHash === null) {
        row.ownerPhone = saved.ownerPhone;
        row.ownerCodeHash = null;
      } else {
        row.attempts += 1;
      }
      return true;
    }),
  };
  return { repository: repository as WhatsappAccountRepositoryPort, row };
}

function fakeMessages(): WhatsappMessageRepositoryPort {
  return { recordBotSend: vi.fn(async () => {}) } as unknown as WhatsappMessageRepositoryPort;
}

function fakeDevice(send: WhatsappDevicePort['send']): WhatsappDevicePort {
  return { reach: vi.fn(), link: vi.fn(), unlink: vi.fn(), send: vi.fn(send) };
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

describe('the owner code', () => {
  // What breaks this: a guessed, stale or brute-forced code confirming a number.
  it('confirms with the right code in time, and locks after five wrong tries', () => {
    const account = connected();
    const named = account.nameOwner(MINE, NOW);
    if (!named) throw new Error('the number was refused');
    expect(named.code).toMatch(/^\d{6}$/);
    expect(account.ownerCodeHash).toBe(hashWhatsappOwnerCode(named.code));
    expect(named.expiresAt.getTime() - NOW.getTime()).toBe(WHATSAPP_OWNER_CODE_TTL_MS);

    const wrong = named.code === '000000' ? '111111' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(account.confirmOwner(wrong, NOW)).toBe('wrong');
    }
    expect(account.confirmOwner(named.code, NOW)).toBe('locked');
    expect(account.ownerPhone).toBeNull();

    const again = account.nameOwner(MINE, NOW);
    expect(account.confirmOwner(again?.code ?? '', NOW)).toBe('confirmed');
    expect(account.isOwner(MINE)).toBe(true);
    expect(account.ownerPendingPhone).toBeNull();
    expect(account.confirmOwner(again?.code ?? '', NOW)).toBe('none');
  });

  it('refuses an expired code', () => {
    const account = connected();
    const named = account.nameOwner(MINE, NOW);
    const late = new Date(NOW.getTime() + WHATSAPP_OWNER_CODE_TTL_MS);
    expect(account.confirmOwner(named?.code ?? '', late)).toBe('expired');
    expect(account.ownerPhone).toBeNull();
  });

  it('will not name the linked number itself, or anything that is not a phone number', () => {
    const account = connected();
    expect(account.nameOwner(SPARE, NOW)).toBeNull();
    expect(account.nameOwner('123@lid', NOW)).toBeNull();
    expect(account.ownerCodeHash).toBeNull();
  });

  // What breaks this: a different phone paired on the account answering the old owner.
  it('forgets the owner and a waiting code when another number pairs', () => {
    const account = connected();
    const named = account.nameOwner(MINE, NOW);
    account.confirmOwner(named?.code ?? '', NOW);
    account.nameOwner('34600777666@s.whatsapp.net', NOW);
    account.report({ state: 'connected', phone: SPARE });
    expect(account.isOwner(MINE)).toBe(true);

    account.report({ state: 'connected', phone: '34600555444@s.whatsapp.net' });
    expect(account).toMatchObject({ ownerPhone: null, ownerCodeHash: null, ownerForgotten: true });
  });
});

describe('RequestWhatsappOwnerCommandHandler', () => {
  const sent = async () => ({ kind: 'sent' as const, id: '3EB9', sentAt: NOW });

  it('sends the code to the named number and keeps only its hash', async () => {
    const account = connected();
    const accounts = fakeAccounts(account);
    const messages = fakeMessages();
    const device = fakeDevice(sent);
    await new RequestWhatsappOwnerCommandHandler(
      accounts.repository,
      messages,
      device,
      new WhatsappMessageMapper(),
    ).execute(
      new RequestWhatsappOwnerCommand({ scope, accountId: account.id, phone: '+34 600 999 888' }),
    );

    const [, chatId, text] = vi.mocked(device.send).mock.calls[0] ?? [];
    const code = /\d{6}/.exec(text ?? '')?.[0] ?? '';
    expect(chatId).toBe(MINE);
    expect(accounts.row.ownerCodeHash).toBe(hashWhatsappOwnerCode(code));
    expect(account.ownerPendingPhone).toBe(MINE);
    // What the bots can read of the chat never holds the code.
    expect(vi.mocked(messages.recordBotSend).mock.calls[0]?.[0]).toMatchObject({
      chatId: MINE,
      sentByBotId: null,
      isReply: false,
    });
    expect(vi.mocked(messages.recordBotSend).mock.calls[0]?.[0].text).not.toContain(code);
  });

  // What breaks this: a code waiting that the owner never received.
  it('leaves no code waiting when the send fails, and says why', async () => {
    const account = connected();
    const accounts = fakeAccounts(account);
    const messages = fakeMessages();
    const code = await codeOf(
      new RequestWhatsappOwnerCommandHandler(
        accounts.repository,
        messages,
        fakeDevice(async () => ({ kind: 'host_offline' })),
        new WhatsappMessageMapper(),
      ).execute(
        new RequestWhatsappOwnerCommand({ scope, accountId: account.id, phone: '+34600999888' }),
      ),
    );
    expect(code).toBe('WHATSAPP_004');
    expect(accounts.row.ownerCodeHash).toBeNull();
    expect(account.ownerPendingPhone).toBeNull();
    expect(messages.recordBotSend).not.toHaveBeenCalled();
  });

  it('refuses the linked number itself with WHATSAPP_013 and sends nothing', async () => {
    const account = connected();
    const device = fakeDevice(sent);
    const code = await codeOf(
      new RequestWhatsappOwnerCommandHandler(
        fakeAccounts(account).repository,
        fakeMessages(),
        device,
        new WhatsappMessageMapper(),
      ).execute(
        new RequestWhatsappOwnerCommand({ scope, accountId: account.id, phone: '+34600111222' }),
      ),
    );
    expect(code).toBe('WHATSAPP_013');
    expect(device.send).not.toHaveBeenCalled();
  });
});

describe('ConfirmWhatsappOwnerCommandHandler', () => {
  const confirm = (accounts: WhatsappAccountRepositoryPort, accountId: string, code: string) =>
    new ConfirmWhatsappOwnerCommandHandler(accounts).execute(
      new ConfirmWhatsappOwnerCommand({ scope, accountId, code }),
    );

  it('moves the waiting number to the owner with the right code', async () => {
    const account = connected();
    const named = account.nameOwner(MINE, new Date());
    const accounts = fakeAccounts(account);
    await confirm(accounts.repository, account.id, named?.code ?? '');
    expect(accounts.row.ownerPhone).toBe(MINE);
  });

  it('answers a wrong code with WHATSAPP_011, the sixth with WHATSAPP_014, and none waiting with WHATSAPP_012', async () => {
    const account = connected();
    const named = account.nameOwner(MINE, new Date());
    const accounts = fakeAccounts(account);
    const wrong = named?.code === '000000' ? '111111' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await codeOf(confirm(accounts.repository, account.id, wrong))).toBe('WHATSAPP_011');
    }
    expect(accounts.row.attempts).toBe(5);
    expect(await codeOf(confirm(accounts.repository, account.id, named?.code ?? ''))).toBe(
      'WHATSAPP_014',
    );
    expect(accounts.row.ownerPhone).toBeNull();

    const fresh = connected();
    expect(await codeOf(confirm(fakeAccounts(fresh).repository, fresh.id, '123456'))).toBe(
      'WHATSAPP_012',
    );
  });

  // What breaks this: a code checked against a replaced one still confirming its number.
  it('confirms nothing when a newer code replaced the one it was checked against', async () => {
    const account = connected();
    const named = account.nameOwner(MINE, new Date());
    const accounts = fakeAccounts(account);
    accounts.row.ownerCodeHash = hashWhatsappOwnerCode('newer');
    expect(await codeOf(confirm(accounts.repository, account.id, named?.code ?? ''))).toBe(
      'WHATSAPP_011',
    );
    expect(accounts.row.ownerPhone).toBeNull();
  });
});
