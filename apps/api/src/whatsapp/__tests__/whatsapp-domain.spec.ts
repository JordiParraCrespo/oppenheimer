import { describe, expect, it } from 'vitest';
import { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import { whatsappContactAction, whatsappInboundAction } from '../domain/whatsapp-inbound.policy';
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

describe('whatsappInboundAction', () => {
  // What breaks this: an owner in Brazil or Mexico who typed their number one
  // way, while WhatsApp writes it the other, confirmed and then never answered.
  it('knows the owner by the form WhatsApp writes their number in, in Brazil and Mexico too', () => {
    const message = (from: string) => ({
      chatId: from,
      chatKind: 'direct' as const,
      fromMe: false,
      senderId: from,
      text: 'hi',
      media: null,
    });
    const pairs = [
      ['5511987654321@s.whatsapp.net', '551187654321@s.whatsapp.net'],
      ['5215512345678@s.whatsapp.net', '525512345678@s.whatsapp.net'],
    ];
    for (const [typed, written] of pairs) {
      for (const [owner, from] of [
        [typed, written],
        [written, typed],
      ]) {
        expect(
          whatsappInboundAction({ phone: null, ownerPhone: owner ?? null }, message(from ?? ''))
            .kind,
        ).toBe('owner');
      }
    }
    // Neither rule makes two other numbers one.
    expect(
      whatsappInboundAction(
        { phone: null, ownerPhone: '5511987654321@s.whatsapp.net' },
        message('5511987654322@s.whatsapp.net'),
      ).kind,
    ).toBe('ignore');
    expect(
      whatsappInboundAction(
        { phone: null, ownerPhone: '34600999888@s.whatsapp.net' },
        message('3460099988@s.whatsapp.net'),
      ).kind,
    ).toBe('ignore');
  });

  const SPARE = '34600111222@s.whatsapp.net';
  const OWNER = '34600999888@s.whatsapp.net';
  const owned = { phone: SPARE, ownerPhone: OWNER };
  const fromOwner = (text: string) => ({
    chatId: OWNER,
    chatKind: 'direct' as const,
    fromMe: false,
    senderId: OWNER,
    text,
    media: null,
  });

  // What breaks this: a stranger answered, or the bot answering itself in a loop.
  it('ignores a stranger, the number’s own messages, groups, its self-chat and everyone before an owner', () => {
    const stranger = '34600333444@s.whatsapp.net';
    expect(
      whatsappInboundAction(owned, { ...fromOwner('hi'), chatId: stranger, senderId: stranger }),
    ).toEqual({ kind: 'ignore' });
    expect(whatsappInboundAction(owned, { ...fromOwner('hi'), fromMe: true })).toEqual({
      kind: 'ignore',
    });
    expect(
      whatsappInboundAction(owned, { ...fromOwner('hi'), chatId: '1203@g.us', chatKind: 'group' }),
    ).toEqual({ kind: 'ignore' });
    expect(
      whatsappInboundAction(owned, { ...fromOwner('hi'), chatId: SPARE, senderId: SPARE }),
    ).toEqual({ kind: 'ignore' });
    expect(whatsappInboundAction({ phone: SPARE, ownerPhone: null }, fromOwner('hi'))).toEqual({
      kind: 'ignore',
    });
  });

  it('reads the owner’s exact /new, /stop and /help as commands, ignoring case', () => {
    expect(whatsappInboundAction(owned, fromOwner(' /NEW '))).toMatchObject({ command: 'new' });
    expect(whatsappInboundAction(owned, fromOwner('/stop'))).toMatchObject({ command: 'stop' });
    expect(whatsappInboundAction(owned, fromOwner('/help'))).toMatchObject({ command: 'help' });
    expect(whatsappInboundAction(owned, fromOwner('/new please'))).toMatchObject({
      command: 'message',
      text: '/new please',
    });
  });

  // What breaks this: "Shop: …" reaching the default bot, or the prefix left in what Shop reads.
  it('takes a leading "Name:" as a switch to match, with what follows as the text', () => {
    expect(whatsappInboundAction(owned, fromOwner('Shop: what sold?\nand when'))).toEqual({
      kind: 'owner',
      command: 'message',
      text: 'what sold?\nand when',
      switchName: 'Shop',
      voiceNote: false,
    });
    expect(whatsappInboundAction(owned, fromOwner('Shop:'))).toMatchObject({
      text: '',
      switchName: 'Shop',
    });
    expect(whatsappInboundAction(owned, fromOwner('what sold?'))).toMatchObject({
      text: 'what sold?',
      switchName: null,
    });
  });

  // What breaks this: the owner's voice note waking the bot with "[audio]" as its words,
  // or a captioned one losing its caption.
  it('takes the owner’s uncaptioned voice note as one to hear, and a caption as its text', () => {
    expect(whatsappInboundAction(owned, { ...fromOwner(''), media: 'audio' })).toEqual({
      kind: 'owner',
      command: 'message',
      text: '',
      switchName: null,
      voiceNote: true,
    });
    expect(whatsappInboundAction(owned, { ...fromOwner('listen'), media: 'audio' })).toMatchObject({
      text: 'listen',
      voiceNote: false,
    });
    expect(whatsappInboundAction(owned, { ...fromOwner(''), media: 'image' })).toMatchObject({
      text: '[image]',
      voiceNote: false,
    });
  });
});

describe('whatsappContactAction', () => {
  const number = '34611000000@s.whatsapp.net';
  const linked = { phone: number, ownerPhone: '34622000000@s.whatsapp.net' };
  const group = '120363000000000001@g.us';
  const marta = '34600999888@s.whatsapp.net';
  const inGroup = (overrides: Partial<Parameters<typeof whatsappContactAction>[2]> = {}) => ({
    chatId: group,
    chatKind: 'group' as const,
    fromMe: false,
    senderId: marta,
    text: '@Juno what time is the dinner?',
    media: null,
    mentions: [] as string[],
    quotedSenderId: null,
    ...overrides,
  });

  // What breaks this: a group set to a bot that stays silent until someone
  // @-mentions the number, which reads as the bot not answering at all.
  it('wakes an allowed group on any message with words, mention or not', () => {
    expect(whatsappContactAction(linked, true, inGroup())).toEqual({
      kind: 'contact',
      text: '@Juno what time is the dinner?',
    });
    expect(whatsappContactAction(linked, true, inGroup({ text: 'dinner at 8' })).kind).toBe(
      'contact',
    );
    expect(whatsappContactAction(linked, true, inGroup({ text: '', media: 'image' }))).toEqual({
      kind: 'contact',
      text: '[image]',
    });
  });

  // What breaks this: a stranger, or a chat the owner never allowed, reaching a bot.
  it('wakes nothing in a chat the number does not allow, on its own messages, or on a voice note without words', () => {
    expect(whatsappContactAction(linked, false, inGroup({ mentions: [number] })).kind).toBe(
      'ignore',
    );
    expect(
      whatsappContactAction(linked, true, inGroup({ mentions: [number], fromMe: true })).kind,
    ).toBe('ignore');
    expect(
      whatsappContactAction(linked, true, inGroup({ mentions: [number], text: '', media: 'audio' }))
        .kind,
    ).toBe('ignore');
  });

  // What breaks this: an allowed person having to mention the number in their own chat.
  it('wakes on any message with words in an allowed person’s chat, from that person only', () => {
    const direct = inGroup({ chatId: marta, chatKind: 'direct', text: 'Hi Juno' });
    expect(whatsappContactAction(linked, true, direct)).toEqual({
      kind: 'contact',
      text: 'Hi Juno',
    });
    expect(whatsappContactAction(linked, true, { ...direct, text: '', media: 'image' })).toEqual({
      kind: 'contact',
      text: '[image]',
    });
    expect(
      whatsappContactAction(linked, true, { ...direct, senderId: '34655000000@s.whatsapp.net' })
        .kind,
    ).toBe('ignore');
  });
});
