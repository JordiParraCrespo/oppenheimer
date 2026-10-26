import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { type GithubFetch, GithubHttp } from '../github-http.adapter';
import { GithubTokensAdapter } from '../github-tokens.adapter';

/**
 * Asking GitHub about a person's own token (§6.2), against a `fetch` double.
 * What is easy to get quietly wrong: a refusal read as GitHub failing (so the
 * person is told to retry a mistyped token), the expiry header misread (so an
 * expired token keeps being chosen), and the secret leaking into a URL or a
 * rate-limit bucket.
 */
interface Answer {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function build(answers: Answer[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const answer = answers.shift() ?? { body: [] };
    return {
      ok: (answer.status ?? 200) < 400,
      status: answer.status ?? 200,
      text: async () => JSON.stringify(answer.body ?? {}),
      headers: { get: (name: string) => answer.headers?.[name] ?? null },
    } as unknown as Response;
  });
  const http = new GithubHttp(
    { get: () => undefined } as unknown as ConfigService,
    impl as unknown as GithubFetch,
  );
  return { adapter: new GithubTokensAdapter(http), calls };
}

const USER = { body: { id: 583231, login: 'ana-dev' } };
const REPOSITORY = {
  id: 99,
  name: 'billing',
  full_name: 'other-org/billing',
  default_branch: 'main',
  private: true,
  archived: false,
  pushed_at: null,
};

describe('asking GitHub about a token', () => {
  it('reads whose it is, when it expires and what it opens', async () => {
    const { adapter } = build([
      { ...USER, headers: { 'github-authentication-token-expiration': '2027-01-24 09:00:00 UTC' } },
      { body: [REPOSITORY] },
    ]);

    const inspection = await adapter.inspect('github_pat_11AAAA');

    expect(inspection).toMatchObject({
      kind: 'fine_grained',
      githubUserId: 583231,
      login: 'ana-dev',
      scopes: null,
      repositories: [{ githubRepoId: 99, fullName: 'other-org/billing', archived: false }],
    });
    expect(inspection.expiresAt?.toISOString()).toBe('2027-01-24T09:00:00.000Z');
  });

  it('reads a classic token’s scopes, and no expiry when GitHub names none', async () => {
    const { adapter } = build([{ ...USER, headers: { 'x-oauth-scopes': 'repo, read:org' } }]);

    const inspection = await adapter.inspect('ghp_AAAAAAAAAAAAAAAAAAAA');

    expect(inspection).toMatchObject({
      kind: 'classic',
      scopes: 'repo, read:org',
      expiresAt: null,
    });
  });

  it('answers a token GitHub refuses with GITHUB_018, not as GitHub failing', async () => {
    const { adapter } = build([{ status: 401, body: { message: 'Bad credentials' } }]);

    await expect(adapter.inspect('ghp_mistyped00000000000')).rejects.toMatchObject({
      code: 'GITHUB_018',
    });
  });

  it('sends the token only as a bearer credential, never in a URL', async () => {
    const { adapter, calls } = build([USER, { body: [] }]);

    await adapter.inspect('github_pat_SECRET');

    for (const call of calls) {
      expect(call.url).not.toContain('SECRET');
      expect((call.init.headers as Record<string, string>).authorization).toBe(
        'Bearer github_pat_SECRET',
      );
    }
  });
});
