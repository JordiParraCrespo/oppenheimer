import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { GithubPullsAdapter } from '../github-pulls.adapter';
import type { GithubFetch } from '../github-rest.adapter';

/**
 * #247: GitHub's limits are waited out, not reported as GitHub failing. A
 * short `Retry-After` is honoured in place; a long one is `GITHUB_015` with
 * when to ask again, so the caller can say "wait" instead of "broken".
 */
interface Answer {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function build(answers: Answer[]) {
  const calls: string[] = [];
  const http = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url));
    const answer = answers.shift() ?? { body: {} };
    const status = answer.status ?? 200;
    const text = JSON.stringify(answer.body ?? {});
    return {
      ok: status < 400,
      status,
      json: async () => answer.body ?? {},
      text: async () => text,
      headers: { get: (name: string) => answer.headers?.[name] ?? null },
    } as unknown as Response;
  });
  const config = { get: () => 'https://api.github.test' } as unknown as ConfigService;
  return { adapter: new GithubPullsAdapter(config, http as unknown as GithubFetch), calls };
}

const PULL = {
  number: 12,
  title: 'Store wallet tokens in the Keychain',
  html_url: 'https://github.com/acme/xrp/pull/12',
  user: { login: 'ana' },
  state: 'open',
  merged_at: null,
  head: { ref: 'oppenheimer/keychain', sha: 'abc' },
  base: { ref: 'main' },
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  closed_at: null,
};

describe('a read GitHub asks to wait for', () => {
  it('waits out a short Retry-After and answers', async () => {
    const { adapter, calls } = build([
      { status: 429, body: { message: 'slow down' }, headers: { 'retry-after': '1' } },
      { body: PULL },
    ]);
    const pull = await adapter.readPullRequest('ghs_token', 'acme/xrp', 12);
    expect(pull.number).toBe(12);
    expect(calls).toHaveLength(2);
  });

  it('gives a long wait back as GITHUB_015 with when to ask again, not as GitHub failing', async () => {
    const { adapter, calls } = build([
      {
        status: 403,
        body: { message: 'You have exceeded a secondary rate limit.' },
        headers: { 'retry-after': '120' },
      },
    ]);
    const refusal = adapter.readPullRequest('ghs_token', 'acme/xrp', 12);
    await expect(refusal).rejects.toMatchObject({ code: 'GITHUB_015' });
    const { extensions } = (await refusal.catch((error) => error)) as {
      extensions: { retryAfterSeconds: number };
    };
    expect(extensions.retryAfterSeconds).toBeGreaterThanOrEqual(120);
    // The gate holds the token: GitHub is not asked again inside the pause.
    expect(calls).toHaveLength(1);
  });

  it('keeps a permission 403 a refusal (GITHUB_009), not a wait', async () => {
    const { adapter } = build([
      { status: 403, body: { message: 'Resource not accessible by integration' } },
    ]);
    await expect(adapter.readChecks('ghs_token', 'acme/xrp', 'abc')).rejects.toMatchObject({
      code: 'GITHUB_009',
      extensions: { upstreamStatus: 403 },
    });
  });
});
