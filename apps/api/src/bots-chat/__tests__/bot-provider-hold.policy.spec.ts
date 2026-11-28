import type { BotTurnFailure, BotTurnOrigin, BotTurnStatus } from '@oppenheimer/shared';
import { BOT_PROVIDER_HOLD_MS, heldByProvider } from '../domain/bot-provider-hold.policy';

/**
 * Whether a turn nobody asked for runs into a provider that just refused the
 * account. What breaks this: a routine or a wake reaching the provider again
 * right after it said the account is out of credit (a column of identical
 * failure cards); a person's message, a goal's or a loop's turn being held
 * when they have their own rules; a hold that never lifts, or one that a
 * failure of the turn rather than the account sets.
 */

const ENDED_AT = new Date('2026-11-15T09:00:00Z');
const later = (ms: number) => new Date(ENDED_AT.getTime() + ms);

function last(status: BotTurnStatus, failure: BotTurnFailure | null) {
  return { status, failure, endedAt: ENDED_AT };
}

const held = (origin: BotTurnOrigin, previous = last('failed', 'usage_limit'), now = later(1000)) =>
  heldByProvider({ origin }, previous, now);

describe('heldByProvider', () => {
  it('holds a routine run and a wake after the account ran out of quota or its key was refused', () => {
    expect(held('routine')).toBe(true);
    expect(held('subscription')).toBe(true);
    expect(held('routine', last('failed', 'credential'))).toBe(true);
  });

  it('never holds a turn a person, a goal or a loop started', () => {
    for (const origin of [
      'message',
      'telegram',
      'whatsapp',
      'approval',
      'question',
      'goal',
      'loop',
    ] as const) {
      expect(held(origin)).toBe(false);
    }
  });

  // What breaks this: a workspace's routines stopping for an hour on a spent key while the next has credit.
  it('holds nothing after a refusal for credit while the provider has another key left', () => {
    expect(
      heldByProvider({ origin: 'routine' }, last('failed', 'usage_limit'), later(1000), true),
    ).toBe(false);
    expect(
      heldByProvider({ origin: 'routine' }, last('failed', 'credential'), later(1000), true),
    ).toBe(true);
  });

  it('lets the turn run once the provider last answered, or failed for a reason of the turn', () => {
    expect(held('routine', last('completed', null))).toBe(false);
    expect(held('routine', last('failed', 'rate_limit'))).toBe(false);
    expect(held('routine', last('failed', 'other'))).toBe(false);
    expect(heldByProvider({ origin: 'routine' }, null, later(1000))).toBe(false);
  });

  it('lifts after the hold, so the next run tries the provider again', () => {
    expect(held('routine', undefined, later(BOT_PROVIDER_HOLD_MS - 1))).toBe(true);
    expect(held('routine', undefined, later(BOT_PROVIDER_HOLD_MS))).toBe(false);
  });
});
