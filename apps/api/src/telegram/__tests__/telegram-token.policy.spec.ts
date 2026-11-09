/**
 * What a refused token does to an account: a bot the host still polls stays
 * connected, anything else needs a new token. The handler path that feeds it
 * is `telegram-handlers.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import { telegramTokenRefusal } from '../domain/telegram-token.policy';

describe('telegramTokenRefusal', () => {
  it('keeps a connected bot connected and says the new token did not take', () => {
    expect(telegramTokenRefusal({ code: 'TG_001' }, 'connected')).toEqual({
      status: 'connected',
      statusReason:
        'The new token was not taken (Telegram refused that token); the bot keeps its old one',
    });
  });

  it('marks any other account revoked, in the host’s words when it gave some', () => {
    expect(telegramTokenRefusal({ code: 'TG_001' }, 'connecting')).toEqual({
      status: 'revoked',
      statusReason: 'Telegram refused that token',
    });
    expect(
      telegramTokenRefusal(
        { code: 'TG_002', detail: '@x is connected; disconnect it first' },
        'revoked',
      ),
    ).toEqual({ status: 'revoked', statusReason: '@x is connected; disconnect it first' });
  });

  it('leaves an account unlinked, not revoked, when Telegram could not be reached to check the token', () => {
    expect(
      telegramTokenRefusal(
        { code: 'TG_003', detail: 'Telegram could not be reached to check the token: timeout' },
        'connecting',
      ),
    ).toEqual({
      status: 'unlinked',
      statusReason: 'Telegram could not be reached to check the token: timeout',
    });
    expect(telegramTokenRefusal({ code: 'TG_009' }, 'unlinked').statusReason).toBe(
      'the host refused it (TG_009)',
    );
  });

  it('bounds the reason to what the account keeps', () => {
    const outcome = telegramTokenRefusal({ code: 'TG_002', detail: 'x'.repeat(500) }, 'connected');
    expect(outcome.statusReason).toHaveLength(200);
  });
});
