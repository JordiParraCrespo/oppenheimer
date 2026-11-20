import { WHATSAPP_CHAT_GRANTS_MAX } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { WhatsappChatGrantEntity } from '../domain/whatsapp-chat-grant.entity';
import {
  type WhatsappChatRouteRow,
  whatsappChatRoutes,
  whatsappRouteChanges,
} from '../domain/whatsapp-chat-route.policy';
import type { WhatsappChat, WhatsappMessage } from '../domain/whatsapp-message.types';

/**
 * Who answers which chats of a number, as Settings and a bot's page set it:
 * the list is every chat the number saw plus every one it allows, never the
 * owner's own or the number's; a change allows, rebinds or stops answering
 * exactly the chats it names, and never past the number's limit.
 */
const OWNER = '34600999888@s.whatsapp.net';
const NUMBER = '34611000000@s.whatsapp.net';
const FAMILY = '120363000000000001@g.us';
const MARTA = '34600111333@s.whatsapp.net';
const account = {
  organizationId: 'org',
  id: 'acc',
  phone: NUMBER,
  isOwner: (chatId: string) => chatId === OWNER,
};

function seen(chatId: string, chatKind: 'direct' | 'group', chatName: string): WhatsappChat {
  return {
    accountId: 'acc',
    chatId,
    chatKind,
    chatName,
    messageCount: 3,
    last: { sentAt: new Date('2026-11-20T10:00:00Z') } as WhatsappMessage,
  };
}

function grant(chatId: string, chatKind: 'direct' | 'group', botId: string | null) {
  return WhatsappChatGrantEntity.allow({
    organizationId: 'org',
    accountId: 'acc',
    chatId,
    chatKind,
    chatName: null,
    botId,
    grantedByBotId: null,
  });
}

describe('whatsappChatRoutes', () => {
  // Breaks if the owner's own chat is offered to route (it is always theirs),
  // or a chat allowed before it ever wrote disappears from Settings.
  it('lists every chat the number saw and every one it allows, but never the owner’s or its own', () => {
    const rows = whatsappChatRoutes(
      account,
      [
        seen(OWNER, 'direct', 'Me'),
        seen(NUMBER, 'direct', 'Spare'),
        seen(FAMILY, 'group', 'Family'),
      ],
      [grant(FAMILY, 'group', 'shop'), grant(MARTA, 'direct', null)],
    );
    expect(rows.map((row) => [row.chatId, row.grant?.botId, row.lastAt === null])).toEqual([
      [FAMILY, 'shop', false],
      [MARTA, null, true],
    ]);
  });
});

describe('whatsappRouteChanges', () => {
  const rows = (): WhatsappChatRouteRow[] =>
    whatsappChatRoutes(
      account,
      [seen(FAMILY, 'group', 'Family'), seen(MARTA, 'direct', 'Marta')],
      [grant(FAMILY, 'group', 'shop')],
    );

  // Breaks if a bulk "Answer with Juno" leaves a chat on its old bot, allows
  // nothing new, or rewrites a chat already as asked.
  it('allows the chats not allowed yet, rebinds the others, and leaves alone what is already so', () => {
    const changes = whatsappRouteChanges(account, rows(), [FAMILY, MARTA], 'bot', 'juno');
    if ('kind' in changes) throw new Error(changes.kind);
    expect(changes.insert.map((g) => [g.chatId, g.chatKind, g.chatName, g.botId])).toEqual([
      [MARTA, 'direct', 'Marta', 'juno'],
    ]);
    expect(changes.save.map((g) => [g.chatId, g.botId])).toEqual([[FAMILY, 'juno']]);

    const same = whatsappRouteChanges(account, rows(), [FAMILY], 'bot', 'shop');
    expect(same).toEqual({ insert: [], save: [], delete: [] });
  });

  // Breaks if "Not answered" leaves the chat allowed, or "Default bot" keeps
  // the old bot.
  it('stops answering a chat by removing its grant, and hands one to the default by clearing its bot', () => {
    const none = whatsappRouteChanges(account, rows(), [FAMILY, MARTA], 'none', null);
    if ('kind' in none) throw new Error(none.kind);
    expect(none.delete.map((g) => g.chatId)).toEqual([FAMILY]);
    expect(none.insert).toEqual([]);

    const fallback = whatsappRouteChanges(account, rows(), [FAMILY], 'default', null);
    if ('kind' in fallback) throw new Error(fallback.kind);
    expect(fallback.save.map((g) => g.botId)).toEqual([null]);
  });

  // Breaks if a forged id allows a chat the number never saw, the owner's
  // own chat becomes someone else's, or the limit is crossed in one go.
  it('refuses a chat it does not list, the owner’s own, and going past the number’s limit', () => {
    expect(
      whatsappRouteChanges(account, rows(), ['34699000000@s.whatsapp.net'], 'default', null),
    ).toEqual({
      kind: 'unknown',
      chatId: '34699000000@s.whatsapp.net',
    });
    expect(whatsappRouteChanges(account, rows(), [OWNER], 'default', null)).toEqual({
      kind: 'not_routable',
      chatId: OWNER,
    });
    const full = Array.from({ length: WHATSAPP_CHAT_GRANTS_MAX }, (_, at) =>
      grant(`34600${String(at).padStart(6, '0')}@s.whatsapp.net`, 'direct', null),
    );
    const crowded = whatsappChatRoutes(account, [seen(MARTA, 'direct', 'Marta')], full);
    expect(whatsappRouteChanges(account, crowded, [MARTA], 'default', null)).toEqual({
      kind: 'limit',
    });
  });
});
