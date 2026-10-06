import { describe, expect, it } from 'vitest';
import {
  CONCURRENCY_PER_TOKEN,
  GithubPausedError,
  GithubRequestGate,
  readRateLimit,
  sleep,
} from '../github-rate-limit.util';

/**
 * #247: one Analytics view opened thousands of GitHub requests at once and
 * GitHub's secondary limit locked the account. These are the two halves of
 * the fix — no more than a few requests per token in flight, and GitHub's own
 * limit headers read as "wait", not as a failure.
 */
const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});
const NOW = 1_800_000_000_000;

describe('reading GitHub’s limits off an answer', () => {
  it('reads a 429 or a secondary-limit 403 as a wait, honouring Retry-After', () => {
    expect(readRateLimit(429, headers({ 'retry-after': '3' }), null, NOW)).toEqual({
      limited: true,
      resumeAt: NOW + 3000,
    });
    expect(
      readRateLimit(
        403,
        headers({}),
        'You have exceeded a secondary rate limit. Please wait a few minutes.',
        NOW,
      ),
    ).toEqual({ limited: true, resumeAt: NOW + 60_000 });
  });

  it('reads a spent hourly budget as a wait until GitHub’s reset', () => {
    const reset = String((NOW + 600_000) / 1000);
    expect(
      readRateLimit(
        403,
        headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset }),
        'API rate limit exceeded',
        NOW,
      ),
    ).toEqual({ limited: true, resumeAt: NOW + 600_000 });
  });

  it('pauses before the refusal when the budget is nearly spent, and leaves a healthy answer alone', () => {
    const reset = String((NOW + 120_000) / 1000);
    expect(
      readRateLimit(
        200,
        headers({ 'x-ratelimit-remaining': '3', 'x-ratelimit-reset': reset }),
        null,
        NOW,
      ),
    ).toEqual({
      limited: false,
      resumeAt: NOW + 120_000,
    });
    expect(readRateLimit(200, headers({ 'x-ratelimit-remaining': '4000' }), null, NOW)).toEqual({
      limited: false,
      resumeAt: null,
    });
  });

  it('keeps a plain permission 403 a refusal, not a wait', () => {
    expect(
      readRateLimit(
        403,
        headers({ 'x-ratelimit-remaining': '4000' }),
        'Resource not accessible by integration',
        NOW,
      ).limited,
    ).toBe(false);
  });
});

describe('the request gate', () => {
  it('never lets one token have more than its share in flight, whatever the caller asks for', async () => {
    const gate = new GithubRequestGate();
    let inFlight = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 40 }, () =>
        gate.run('ghs_token', async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await sleep(2);
          inFlight -= 1;
        }),
      ),
    );
    expect(peak).toBe(CONCURRENCY_PER_TOKEN);
  });

  it('gives each token its own lane', async () => {
    const gate = new GithubRequestGate();
    let inFlight = 0;
    let peak = 0;
    const work = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(2);
      inFlight -= 1;
    };
    await Promise.all([
      ...Array.from({ length: 10 }, () => gate.run('token-a', work)),
      ...Array.from({ length: 10 }, () => gate.run('token-b', work)),
    ]);
    expect(peak).toBe(CONCURRENCY_PER_TOKEN * 2);
  });

  it('sends nothing while GitHub’s pause outlasts what a request holds, and says when to ask again', async () => {
    const gate = new GithubRequestGate();
    const until = Date.now() + 10 * 60_000;
    gate.pause('ghs_token', until);
    let sent = false;
    await expect(
      gate.run('ghs_token', async () => {
        sent = true;
      }),
    ).rejects.toEqual(new GithubPausedError(until));
    expect(sent).toBe(false);
  });

  it('keeps no lane for a token once it is idle and unpaused: installation tokens turn over hourly', async () => {
    const gate = new GithubRequestGate();
    await Promise.all(['a', 'b', 'c'].map((token) => gate.run(token, async () => undefined)));
    expect(gate.size).toBe(0);

    gate.pause('expired', Date.now() - 1);
    await gate.run('fresh', async () => undefined);
    expect(gate.size).toBe(0);
  });
});
