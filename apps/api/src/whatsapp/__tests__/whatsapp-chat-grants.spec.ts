import 'reflect-metadata';
import type { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { WHATSAPP_CHAT_GRANTS_MAX } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { WhatsappChatResolver } from '../application/whatsapp-chat.resolver';
import { AllowWhatsappChatCommand } from '../commands/allow-whatsapp-chat/allow-whatsapp-chat.command';
import { AllowWhatsappChatCommandHandler } from '../commands/allow-whatsapp-chat/allow-whatsapp-chat.command-handler';
import { RevokeWhatsappChatCommand } from '../commands/revoke-whatsapp-chat/revoke-whatsapp-chat.command';
import { RevokeWhatsappChatCommandHandler } from '../commands/revoke-whatsapp-chat/revoke-whatsapp-chat.command-handler';
import type { WhatsappAccountRepositoryPort } from '../database/whatsapp-account.repository.port';
import type { WhatsappChatGrantRepositoryPort } from '../database/whatsapp-chat-grant.repository.port';
import type { WhatsappMessageRepositoryPort } from '../database/whatsapp-message.repository.port';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import type { WhatsappChatGrantEntity } from '../domain/whatsapp-chat-grant.entity';
import type { WhatsappChat } from '../domain/whatsapp-message.types';

/**
 * Who may be allowed to talk on a number: nobody until the owner's own number
 * is confirmed, never the owner's own chat nor the number itself, at most
 * `WHATSAPP_CHAT_GRANTS_MAX` chats, one grant per chat (allowing again changes
 * its bot), and only on the caller's own number.
 */

const ORG = '0b3e2a1c-1111-4c5d-8e6f-70819203b4c5';
const USER = '0b3e2a1c-2222-4c5d-8e6f-70819203b4c5';
const OTHER = '0b3e2a1c-4444-4c5d-8e6f-70819203b4c5';
const HOST = '0b3e2a1c-3333-4c5d-8e6f-70819203b4c5';
const SPARE = '34600111222@s.whatsapp.net';
const OWNER = '34600999888@s.whatsapp.net';
const FAMILY = '120363000000000001@g.us';

const scopeOf = (userId = USER): AccessScope => ({
  userId,
  organizationId: ORG,
  teamIds: [],
  grants: new Map(),
  bypass: false,
});

function number(options: { confirmed: boolean }): WhatsappAccountEntity {
  const linked = WhatsappAccountEntity.link({
    organizationId: ORG,
    userId: USER,
    hostId: HOST,
    label: 'Spare',
  });
  linked.report({ state: 'connected', phone: SPARE });
  if (options.confirmed) {
    const sent = linked.nameOwner(OWNER, new Date());
    if (!sent) throw new Error('the owner could not be named');
    linked.confirmOwner(sent.code, new Date());
  }
  return linked;
}

function chat(chatId: string, chatKind: 'direct' | 'group', chatName: string): WhatsappChat {
  return { accountId: 'a', chatId, chatKind, chatName, messageCount: 1 } as WhatsappChat;
}

function harness(account: WhatsappAccountEntity, existing = 0) {
  const accounts = {
    findOwnById: async (scope: AccessScope, id: string) =>
      id === account.id && scope.userId === account.userId ? Some(account) : None,
  } as unknown as WhatsappAccountRepositoryPort;
  const messages = {
    findChats: async () => [
      chat(FAMILY, 'group', 'Family'),
      chat(OWNER, 'direct', 'Me'),
      chat('34600333444@s.whatsapp.net', 'direct', 'Marta'),
    ],
  } as unknown as WhatsappMessageRepositoryPort;
  const rows: WhatsappChatGrantEntity[] = [];
  const grants: WhatsappChatGrantRepositoryPort = {
    findAll: async () => rows,
    findById: async (_of, id) => {
      const row = rows.find((item) => item.id === id);
      return row ? Some(row) : None;
    },
    findByChat: async (_of, chatId) => {
      const row = rows.find((item) => item.chatId === chatId);
      return row ? Some(row) : None;
    },
    count: async () => existing + rows.length,
    insert: vi.fn(async (grant) => {
      rows.push(grant);
      return 'inserted' as const;
    }),
    save: vi.fn(async () => {}),
    delete: vi.fn(async (grant) => {
      rows.splice(rows.indexOf(grant), 1);
    }),
  };
  const queryBus = { execute: vi.fn(async () => ({})) } as unknown as QueryBus;
  const resolver = new WhatsappChatResolver(accounts, messages);
  return {
    rows,
    grants,
    allow: (wanted: string, props: { botId?: string | null; scope?: AccessScope } = {}) =>
      new AllowWhatsappChatCommandHandler(resolver, grants, queryBus).execute(
        new AllowWhatsappChatCommand({
          scope: props.scope ?? scopeOf(),
          accountId: account.id,
          chat: wanted,
          botId: props.botId,
          grantedByBotId: 'bot-juno',
        }),
      ),
    revoke: (grantId: string) =>
      new RevokeWhatsappChatCommandHandler(resolver, grants).execute(
        new RevokeWhatsappChatCommand({ scope: scopeOf(), accountId: account.id, grantId }),
      ),
  };
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

describe('AllowWhatsappChatCommandHandler', () => {
  // What breaks this: a bot allowing chats on a number nobody has proven is theirs.
  it('allows nothing until the owner’s own number is confirmed', async () => {
    const { allow, rows } = harness(number({ confirmed: false }));
    expect(await codeOf(allow('Family'))).toBe('WHATSAPP_015');
    expect(rows).toHaveLength(0);
  });

  // What breaks this: the owner's own chat, or the number's, turned into a contact's.
  it('refuses the owner’s own chat and the number’s chat with itself', async () => {
    const { allow, rows } = harness(number({ confirmed: true }));
    expect(await codeOf(allow('Me'))).toBe('WHATSAPP_017');
    expect(await codeOf(allow('+34 600 111 222'))).toBe('WHATSAPP_017');
    expect(rows).toHaveLength(0);
  });

  // What breaks this: a chat allowed twice, or a second allow forgetting which bot answers.
  it('allows a group once by its name, records the bot that allowed it, and changes its bot when allowed again', async () => {
    const { allow, rows } = harness(number({ confirmed: true }));
    const first = await allow('family');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      chatId: FAMILY,
      chatKind: 'group',
      chatName: 'Family',
      botId: null,
      grantedByBotId: 'bot-juno',
    });
    const second = await allow(FAMILY, { botId: '0b3e2a1c-5555-4c5d-8e6f-70819203b4c5' });
    expect(second).toBe(first);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.botId).toBe('0b3e2a1c-5555-4c5d-8e6f-70819203b4c5');
    await allow('Family');
    expect(rows[0]?.botId).toBe('0b3e2a1c-5555-4c5d-8e6f-70819203b4c5');
  });

  it('allows a person who has not written yet by their phone number', async () => {
    const { allow, rows } = harness(number({ confirmed: true }));
    await allow('+34 611 222 333');
    expect(rows[0]).toMatchObject({ chatId: '34611222333@s.whatsapp.net', chatKind: 'direct' });
  });

  it('stops at the most chats a number allows', async () => {
    const { allow } = harness(number({ confirmed: true }), WHATSAPP_CHAT_GRANTS_MAX);
    expect(await codeOf(allow('Family'))).toBe('WHATSAPP_018');
  });

  // What breaks this: someone else allowing chats on a number that is not theirs.
  it('treats someone else’s number as not linked', async () => {
    const { allow } = harness(number({ confirmed: true }));
    expect(await codeOf(allow('Family', { scope: scopeOf(OTHER) }))).toBe('WHATSAPP_001');
  });
});

describe('RevokeWhatsappChatCommandHandler', () => {
  it('forgets an allowed chat, and answers WHATSAPP_016 for one that is not', async () => {
    const { allow, revoke, rows } = harness(number({ confirmed: true }));
    const grantId = await allow('Family');
    await revoke(grantId);
    expect(rows).toHaveLength(0);
    expect(await codeOf(revoke(grantId))).toBe('WHATSAPP_016');
  });
});
