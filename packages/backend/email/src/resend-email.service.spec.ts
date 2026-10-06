import { describe, expect, it } from 'vitest';
import { rateLimitResetOf } from './resend-email.service';

/**
 * When Resend will take mail again decides how long the email queue is held. A
 * refusal misread as "not about rate" spends the job's retries and drops the
 * mail; one misread as "about rate" holds every email for nothing.
 */

const NOW = Date.parse('2026-10-06T12:00:00.000Z');

describe('rateLimitResetOf', () => {
  it('honours the wait Resend names on a per-second refusal', () => {
    expect(
      rateLimitResetOf(
        { name: 'rate_limit_exceeded', statusCode: 429 },
        { 'Retry-After': '3' },
        NOW,
      ),
    ).toEqual(new Date(NOW + 3_000));
  });

  it('waits a second when a 429 names no wait', () => {
    expect(rateLimitResetOf({ name: 'rate_limit_exceeded', statusCode: 429 }, null, NOW)).toEqual(
      new Date(NOW + 1_000),
    );
  });

  it('holds a spent quota until Resend resets it: the next UTC day, or month', () => {
    expect(rateLimitResetOf({ name: 'daily_quota_exceeded', statusCode: 429 }, null, NOW)).toEqual(
      new Date('2026-10-07T00:00:00.000Z'),
    );
    expect(
      rateLimitResetOf({ name: 'monthly_quota_exceeded', statusCode: 429 }, null, NOW),
    ).toEqual(new Date('2026-11-01T00:00:00.000Z'));
  });

  it('leaves every other refusal to the job’s ordinary retry', () => {
    expect(
      rateLimitResetOf({ name: 'invalid_from_address', statusCode: 422 }, null, NOW),
    ).toBeNull();
  });
});
