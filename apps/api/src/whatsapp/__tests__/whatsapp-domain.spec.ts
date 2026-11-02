import { describe, expect, it } from 'vitest';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import type { WhatsappChat, WhatsappMessage } from '../domain/whatsapp-message.types';
import { pickWhatsappChat, whatsappSendRefusal } from '../domain/whatsapp-send.policy';

const account = () =>
  WhatsappAccountEntity.link({
    organizationId: 'org',
    userId: 'user',
    hostId: 'host',
    label: '  ',
  });

function chat(chatId: string, chatName: string | null): WhatsappChat {
  return {
    accountId: 'a',
    chatId,
    chatKind: 'direct',
    chatName,
    messageCount: 1,
    last: {} as WhatsappMessage,
  };
}

describe('WhatsappAccountEntity', () => {
  it('starts pairing, named WhatsApp when the person gave no name', () => {
    expect(account()).toMatchObject({ status: 'pairing', label: 'WhatsApp' });
  });

  it('keeps a QR only while pairing, and the number once it learned it', () => {
    const linked = account();
    linked.report({ state: 'pairing', qr: '2@abc', qrExpiresAt: new Date('2026-10-30T10:00:20Z') });
    expect(linked.qr).toBe('2@abc');

    linked.report({
      state: 'connected',
      phone: '34600111222@s.whatsapp.net',
      name: 'Jordi',
      qr: 'stale',
    });
    expect(linked).toMatchObject({
      status: 'connected',
      qr: null,
      qrExpiresAt: null,
      displayName: 'Jordi',
    });

    linked.report({ state: 'connecting' });
    expect(linked.phone).toBe('34600111222@s.whatsapp.net');
  });

  it('pairs again from a logout, clearing the reason', () => {
    const linked = account();
    linked.report({ state: 'logged_out', reason: 'removed from the phone' });
    linked.repair('Shop');
    expect(linked).toMatchObject({ status: 'pairing', statusReason: null, label: 'Shop' });
  });
});

describe('whatsappSendRefusal', () => {
  it('sends only while connected and under the day’s share', () => {
    expect(whatsappSendRefusal('connected', 99, 100)).toBeNull();
    expect(whatsappSendRefusal('connected', 100, 100)).toBe('limit_reached');
    expect(whatsappSendRefusal('connecting', 0, 100)).toBe('not_connected');
  });
});

describe('pickWhatsappChat', () => {
  const chats = [
    chat('34600333444@s.whatsapp.net', 'Marta'),
    chat('34600555666@s.whatsapp.net', 'Marta Ruiz'),
    chat('1203@g.us', 'Family'),
  ];

  it('takes an id exactly, and a name whole before a part of one', () => {
    expect(pickWhatsappChat(chats, '1203@g.us')).toBe(chats[2]);
    expect(pickWhatsappChat(chats, 'marta')).toBe(chats[0]);
    expect(pickWhatsappChat(chats, 'fam')).toBe(chats[2]);
  });

  it('answers ambiguous for a part two names share, and nothing for none', () => {
    expect(pickWhatsappChat(chats, 'mart')).toBe('ambiguous');
    expect(pickWhatsappChat(chats, 'Pedro')).toBeNull();
  });
});
