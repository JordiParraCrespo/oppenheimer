import { describe, expect, it } from 'vitest';
import {
  TELEGRAM_OWNER_LINK_TTL_MS,
  TelegramAccountEntity,
} from '../domain/telegram-account.entity';
import {
  TELEGRAM_HELP_LINE,
  TELEGRAM_NO_BOT_LINE,
  telegramInboundAction,
} from '../domain/telegram-inbound.policy';
import { splitTelegramText } from '../domain/telegram-text.policy';

/**
 * Who a Telegram bot answers (`product/next-steps/answering-on-telegram-and-whatsapp.md`
 * §2): only the owner the one-time `start` link recorded, in their own
 * direct chat; nobody else's message reaches a bot.
 */

const OWNER = '111';
const BOT = 'bot-1';

function connected(): TelegramAccountEntity {
  const account = TelegramAccountEntity.link({
    organizationId: 'org',
    userId: 'user',
    hostId: 'host',
    label: 'Shop',
  });
  account.report({ state: 'connected', botId: '7000', username: 'shop_bot' });
  return account;
}

const direct = (senderId: string, text: string) => ({
  chatKind: 'direct' as const,
  fromBot: false,
  senderId,
  text,
  media: null,
});

describe('the owner link', () => {
  // What breaks this: a guessed, reused or stale code recording an owner.
  it('records whoever sends the open code, once, before it expires', () => {
    const now = new Date('2026-11-09T10:00:00Z');
    const account = connected();
    const { code, expiresAt } = account.openOwnerLink(now);

    expect(expiresAt.getTime() - now.getTime()).toBe(TELEGRAM_OWNER_LINK_TTL_MS);
    expect(account.ownerLinkCodeHash).not.toContain(code);
    expect(account.claimOwner('not-the-code', OWNER, now)).toBe(false);
    expect(account.claimOwner(code, OWNER, now)).toBe(true);
    expect(account.isOwner(OWNER)).toBe(true);
    expect(account.claimOwner(code, '999', now)).toBe(false);
    expect(account.isOwner('999')).toBe(false);
  });

  it('records nobody once the link has expired', () => {
    const now = new Date('2026-11-09T10:00:00Z');
    const account = connected();
    const { code } = account.openOwnerLink(now);
    const late = new Date(now.getTime() + TELEGRAM_OWNER_LINK_TTL_MS);
    expect(account.claimOwner(code, OWNER, late)).toBe(false);
    expect(account.ownerTelegramId).toBeNull();
  });

  // What breaks this: a new token for another Telegram bot keeping the old owner.
  it('forgets the owner when the account now holds a different Telegram bot', () => {
    const account = connected();
    const { code } = account.openOwnerLink(new Date());
    account.claimOwner(code, OWNER, new Date());
    account.report({ state: 'connected', botId: '7000' });
    expect(account.isOwner(OWNER)).toBe(true);
    account.report({ state: 'connected', botId: '8000' });
    expect(account.ownerTelegramId).toBeNull();
  });
});

describe('telegramInboundAction', () => {
  const owned = { ownerTelegramId: OWNER, answeringBotId: BOT };

  it('wakes the bot only for the owner in their own direct chat', () => {
    expect(telegramInboundAction(owned, direct(OWNER, ' hi there '))).toEqual({
      kind: 'owner',
      command: 'message',
      text: 'hi there',
    });
    expect(telegramInboundAction(owned, direct('222', 'hi'))).toEqual({ kind: 'stranger' });
    expect(telegramInboundAction(owned, { ...direct(OWNER, 'hi'), chatKind: 'group' })).toEqual({
      kind: 'ignore',
    });
    expect(telegramInboundAction(owned, { ...direct(OWNER, 'hi'), fromBot: true })).toEqual({
      kind: 'ignore',
    });
  });

  it('reads a start code from anyone, and commands only from the owner', () => {
    expect(telegramInboundAction(owned, direct('222', '/start abc_DEF-1'))).toEqual({
      kind: 'link',
      code: 'abc_DEF-1',
    });
    expect(telegramInboundAction(owned, direct('222', '/new'))).toEqual({ kind: 'stranger' });
    // The owner tapping a link again is answered as the owner, never as a stranger.
    expect(telegramInboundAction(owned, direct(OWNER, '/start abc_DEF-1'))).toEqual({
      kind: 'reply',
      text: TELEGRAM_HELP_LINE,
    });
    expect(telegramInboundAction(owned, direct(OWNER, '/new@shop_bot'))).toMatchObject({
      kind: 'owner',
      command: 'new',
    });
    expect(telegramInboundAction(owned, direct(OWNER, '/stop'))).toMatchObject({
      command: 'stop',
    });
    expect(telegramInboundAction(owned, direct(OWNER, '/help'))).toEqual({
      kind: 'reply',
      text: TELEGRAM_HELP_LINE,
    });
  });

  it('tells the owner when no bot answers here, and wakes nothing', () => {
    expect(
      telegramInboundAction({ ownerTelegramId: OWNER, answeringBotId: null }, direct(OWNER, 'hi')),
    ).toEqual({ kind: 'reply', text: TELEGRAM_NO_BOT_LINE });
  });

  it('treats everyone as a stranger before an owner is recorded', () => {
    expect(
      telegramInboundAction({ ownerTelegramId: null, answeringBotId: BOT }, direct(OWNER, 'hi')),
    ).toEqual({ kind: 'stranger' });
  });
});

describe('splitTelegramText', () => {
  it('keeps a reply that fits whole, and cuts a long one at a space under the limit', () => {
    expect(splitTelegramText('  short  ')).toEqual(['short']);
    const parts = splitTelegramText(`${'word '.repeat(30)}end`, 40);
    expect(parts.every((part) => part.length <= 40)).toBe(true);
    expect(parts.join(' ')).toBe(`${'word '.repeat(30)}end`);
  });
});
