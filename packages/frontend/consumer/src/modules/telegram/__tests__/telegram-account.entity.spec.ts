import { describe, expect, it } from 'vitest';
import { TelegramAccountEntity, type TelegramAccountStatus } from '../telegram-account.entity';

/**
 * What Settings → Telegram reads off a connected bot: its t.me address, whether
 * the page keeps asking how it stands (only while an online host connects it),
 * and when it offers Connect again (only once the token is gone).
 */
function account(status: TelegramAccountStatus, username: string | null = null, hostOnline = true) {
  return new TelegramAccountEntity(
    'a',
    'h',
    'Shop',
    status,
    hostOnline,
    '7012345678',
    username,
    null,
    null,
    '2026-11-08T09:00:00Z',
  );
}

describe('TelegramAccountEntity', () => {
  it('links to the bot on t.me once its username is known', () => {
    expect(account('connected', 'shop_helper_bot').link).toBe('https://t.me/shop_helper_bot');
    expect(account('connecting').link).toBeNull();
  });

  it('polls only while an online host connects it, and asks for a token only once it is gone', () => {
    expect(account('connecting').isConnecting).toBe(true);
    expect(account('connecting', null, false).isConnecting).toBe(false);
    expect(account('connected').isConnecting).toBe(false);
    expect(account('revoked').needsToken).toBe(true);
    expect(account('unlinked').needsToken).toBe(true);
    expect(account('connected').needsToken).toBe(false);
  });
});
