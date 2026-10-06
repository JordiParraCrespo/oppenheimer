import { describe, expect, it } from 'vitest';
import { readRateLimit } from '../rate-limit-signal';

/**
 * Providers spell their limits differently, and a misread one either hammers a
 * provider that said stop or pauses one that did not. These pin each spelling.
 */

const NOW = Date.parse('2026-10-06T12:00:00.000Z');

function answer(status: number, headers: Record<string, string> = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { status, headers: { get: (name: string) => lower[name.toLowerCase()] ?? null } };
}

describe('readRateLimit', () => {
  it('reads GitHub’s exhausted primary limit: a 403 with no calls left, reset in epoch seconds', () => {
    const reset = NOW / 1000 + 900;
    const signal = readRateLimit(
      answer(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
      NOW,
    );

    expect(signal).toEqual({ limited: true, remaining: 0, resetAt: new Date(reset * 1000) });
  });

  it('does not take a plain 403 — a permission refusal — for a rate limit', () => {
    expect(readRateLimit(answer(403, { 'x-ratelimit-remaining': '4999' }), NOW).limited).toBe(
      false,
    );
  });

  it('prefers Retry-After over a window reset, in seconds or as a date', () => {
    const inSeconds = readRateLimit(
      answer(429, { 'retry-after': '30', 'x-ratelimit-reset': String(NOW / 1000 + 900) }),
      NOW,
    );
    const asDate = readRateLimit(
      answer(429, { 'retry-after': 'Tue, 06 Oct 2026 12:02:00 GMT' }),
      NOW,
    );

    expect(inSeconds.resetAt).toEqual(new Date(NOW + 30_000));
    expect(asDate.resetAt).toEqual(new Date('2026-10-06T12:02:00.000Z'));
  });

  it('reads a reset that is seconds from now, and the IETF draft’s structured field', () => {
    expect(readRateLimit(answer(429, { 'x-ratelimit-reset': '12' }), NOW).resetAt).toEqual(
      new Date(NOW + 12_000),
    );
    expect(readRateLimit(answer(200, { ratelimit: '"default";r=0;t=30' }), NOW)).toEqual({
      limited: false,
      remaining: 0,
      resetAt: new Date(NOW + 30_000),
    });
  });

  it('reports a successful answer’s remaining budget, so the last call can pause the next', () => {
    expect(readRateLimit(answer(200, { 'x-ratelimit-remaining': '0' }), NOW)).toMatchObject({
      limited: false,
      remaining: 0,
    });
  });
});
