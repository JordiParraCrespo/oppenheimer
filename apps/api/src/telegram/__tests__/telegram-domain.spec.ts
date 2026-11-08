import { describe, expect, it } from 'vitest';
import { TelegramAccountEntity } from '../domain/telegram-account.entity';
import type { TelegramChat, TelegramMessage } from '../domain/telegram-message.types';
import { pickTelegramChat, telegramSendRefusal } from '../domain/telegram-send.policy';

const account = () =>
  TelegramAccountEntity.link({
    organizationId: 'org',
    userId: 'user',
    hostId: 'host',
    label: '  ',
  });

function chat(
  chatId: string,
  chatName: string | null,
  last: Partial<TelegramMessage> = {},
): TelegramChat {
  return {
    accountId: 'a',
    chatId,
    chatKind: chatId.startsWith('-') ? 'group' : 'direct',
    chatName,
    messageCount: 1,
    last: { fromBot: false, senderUsername: null, ...last } as TelegramMessage,
  };
}

describe('TelegramAccountEntity', () => {
  it('starts connecting, named Telegram when the person gave no name', () => {
    expect(account()).toMatchObject({ status: 'connecting', label: 'Telegram' });
  });

  it('keeps the bot’s id, username and name once learned', () => {
    const linked = account();
    linked.report({
      state: 'connected',
      botId: '7012345678',
      username: 'shop_helper_bot',
      name: 'Shop helper',
    });
    linked.report({ state: 'connecting' });
    expect(linked).toMatchObject({
      status: 'connecting',
      botId: '7012345678',
      username: 'shop_helper_bot',
      displayName: 'Shop helper',
    });
  });

  it('connects again from a revoked token, clearing the reason', () => {
    const linked = account();
    linked.report({ state: 'revoked', reason: 'Telegram refused that token' });
    linked.reconnect('Shop');
    expect(linked).toMatchObject({ status: 'connecting', statusReason: null, label: 'Shop' });
  });
});

describe('telegramSendRefusal', () => {
  it('sends only while connected and under the day’s share', () => {
    expect(telegramSendRefusal('connected', 199, 200)).toBeNull();
    expect(telegramSendRefusal('connected', 200, 200)).toBe('limit_reached');
    expect(telegramSendRefusal('revoked', 0, 200)).toBe('not_connected');
  });
});

describe('pickTelegramChat', () => {
  const chats = [
    chat('123456789', 'Marta Vidal', { senderUsername: 'martav' }),
    chat('223456789', 'Marta Ruiz', { senderUsername: 'mruiz' }),
    chat('-1001234567890', 'Shop team'),
  ];

  it('takes an id exactly, an @username, and a name whole before a part of one', () => {
    expect(pickTelegramChat(chats, '-1001234567890')).toBe(chats[2]);
    expect(pickTelegramChat(chats, '@MartaV')).toBe(chats[0]);
    expect(pickTelegramChat(chats, 'marta ruiz')).toBe(chats[1]);
    expect(pickTelegramChat(chats, 'shop')).toBe(chats[2]);
  });

  it('answers ambiguous for a part two names share, and nothing for none', () => {
    expect(pickTelegramChat(chats, 'marta')).toBe('ambiguous');
    expect(pickTelegramChat(chats, 'Pedro')).toBeNull();
  });
});
