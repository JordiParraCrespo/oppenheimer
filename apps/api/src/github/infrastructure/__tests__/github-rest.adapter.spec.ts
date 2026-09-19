import { generateKeyPairSync } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { CapabilitiesService } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type { GithubFetch } from '../github-rest.adapter';
import { GithubRestAdapter } from '../github-rest.adapter';

/**
 * The adapter is the only thing in the repository that talks to GitHub, and it
 * owns two things a client library would otherwise: the App JWT and pagination.
 * Both are asserted here against a `fetch` double, so these tests never touch
 * the network.
 *
 * The rest is the part that is easy to get quietly wrong — a token in a URL, a
 * rejected OAuth code answered with 200, a suspended installation and a bad App
 * key collapsing into one error code.
 */

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const CONFIG: Record<string, string> = {
  'githubApp.appId': '1234567',
  'githubApp.privateKey': privateKey,
  'githubApp.webhookSecret': 'whsec',
  'githubApp.clientId': 'Iv1.abc',
  'githubApp.clientSecret': 'shhh',
  'githubApp.slug': 'oppenheimer-sessions',
};

function configWith(values: Record<string, string> = CONFIG): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

interface Answer {
  status?: number;
  body?: unknown;
  link?: string;
}

/** Records every call and answers them in order. */
function fakeFetch(answers: Answer[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const answer = answers.shift() ?? { body: {} };
    return {
      ok: (answer.status ?? 200) < 400,
      status: answer.status ?? 200,
      json: async () => answer.body ?? {},
      headers: { get: (name: string) => (name === 'link' ? (answer.link ?? null) : null) },
    } as unknown as Response;
  });
  return { impl: impl as unknown as GithubFetch, calls, raw: impl };
}

function build(answers: Answer[], options: { configured?: boolean } = {}) {
  const http = fakeFetch(answers);
  const capabilities = new CapabilitiesService({ github_app: options.configured ?? true });
  return {
    adapter: new GithubRestAdapter(configWith(), capabilities, http.impl),
    http,
  };
}

const TOKEN_ANSWER: Answer = {
  body: { token: 'ghs_minted', expires_at: '2026-09-19T12:00:00.000Z' },
};

const INSTALLATION = {
  id: 45678901,
  account: { login: 'acme-labs', type: 'Organization' },
  repository_selection: 'selected',
  suspended_at: null,
};

const REPOSITORY = {
  id: 831004242,
  name: 'oppenheimer',
  full_name: 'acme-labs/oppenheimer',
  default_branch: 'main',
  private: true,
  archived: false,
  pushed_at: '2026-09-18T10:00:00.000Z',
};

function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.[name];
}

describe('configuration', () => {
  it('asks the capability rather than re-deriving one of its own', () => {
    // The two used to be different subsets, so a deployment with no App slug
    // reported `github_app: false` and still answered `POST /installations` 201.
    expect(build([]).adapter.isConfigured()).toBe(true);
    expect(build([], { configured: false }).adapter.isConfigured()).toBe(false);
  });

  it('answers GITHUB_002 rather than calling GitHub unconfigured', async () => {
    const { adapter, http } = build([], { configured: false });

    await expect(adapter.mintRepositoryToken(45678901, 831004242)).rejects.toMatchObject({
      code: 'GITHUB_002',
    });
    expect(http.raw).not.toHaveBeenCalled();
  });
});

describe('the App JWT', () => {
  it('is an RS256 JWT issued by the App, short-lived and backdated', async () => {
    const { adapter, http } = build([TOKEN_ANSWER]);

    await adapter.mintRepositoryToken(45678901, 831004242);

    const authorization = headerOf(http.calls[0].init, 'authorization') ?? '';
    const [rawHeader, rawPayload, signature] = authorization.replace('Bearer ', '').split('.');
    expect(signature).toBeTruthy();

    const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(payload.iss).toBe('1234567');
    // GitHub refuses a JWT living longer than ten minutes, and one whose `iat`
    // is in its own future — which an unsynchronised clock makes routine.
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(600);
    expect(payload.iat).toBeLessThanOrEqual(now);
    expect(payload.exp).toBeGreaterThan(now);
  });

  it('restores escaped newlines in a single-line private key', async () => {
    const http = fakeFetch([TOKEN_ANSWER]);
    const escaped = { ...CONFIG, 'githubApp.privateKey': privateKey.replace(/\n/g, '\\n') };
    const adapter = new GithubRestAdapter(
      configWith(escaped),
      new CapabilitiesService({ github_app: true }),
      http.impl,
    );

    // A PEM from a one-line .env or a container secret arrives like this, and
    // the signer would otherwise throw an opaque parse error.
    await expect(adapter.mintRepositoryToken(45678901, 831004242)).resolves.toMatchObject({
      token: 'ghs_minted',
    });
  });
});

describe('minting a repository token', () => {
  it('asks for one repository, with contents and metadata only', async () => {
    const { adapter, http } = build([TOKEN_ANSWER]);

    const minted = await adapter.mintRepositoryToken(45678901, 831004242);

    expect(http.calls[0].url).toBe(
      'https://api.github.com/app/installations/45678901/access_tokens',
    );
    expect(http.calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(http.calls[0].init.body))).toEqual({
      repository_ids: [831004242],
      permissions: { contents: 'write', metadata: 'read' },
    });
    expect(minted).toEqual({
      token: 'ghs_minted',
      expiresAt: new Date('2026-09-19T12:00:00.000Z'),
    });
  });

  it('sends the version and agent headers GitHub requires, and no credential in the URL', async () => {
    const { adapter, http } = build([TOKEN_ANSWER]);

    await adapter.mintRepositoryToken(45678901, 831004242);

    const { url, init } = http.calls[0];
    expect(headerOf(init, 'accept')).toBe('application/vnd.github+json');
    expect(headerOf(init, 'x-github-api-version')).toBe('2022-11-28');
    expect(headerOf(init, 'user-agent')).toBeTruthy();
    // The credential travels in a header. In a URL it would reach every log,
    // proxy and error message that ever names the request.
    expect(url).not.toContain('Bearer');
    expect(init.signal).toBeDefined();
  });

  it('keeps a suspended install, a missing one and a repository apart', async () => {
    // One code for all three is how the catalog stops being worth having.
    await expect(
      build([{ status: 422, body: { message: 'not accessible' } }]).adapter.mintRepositoryToken(
        45678901,
        831004242,
      ),
    ).rejects.toMatchObject({ code: 'GITHUB_010' });
    await expect(
      build([{ status: 404 }]).adapter.mintRepositoryToken(45678901, 831004242),
    ).rejects.toMatchObject({ code: 'GITHUB_001' });
    await expect(
      build([{ status: 403 }]).adapter.listInstallationRepositories(45678901),
    ).rejects.toMatchObject({ code: 'GITHUB_008' });
  });

  it('reports a rejected App credential as a configuration problem', async () => {
    // A 401 is never the caller's fault: the App key did not verify.
    await expect(
      build([{ status: 401 }]).adapter.mintRepositoryToken(45678901, 831004242),
    ).rejects.toMatchObject({ code: 'GITHUB_002' });
  });

  it('reports upstream trouble as a 502, with GitHub’s own sentence', async () => {
    const { adapter } = build([{ status: 503, body: { message: 'Service unavailable' } }]);

    await expect(adapter.mintRepositoryToken(45678901, 831004242)).rejects.toMatchObject({
      code: 'GITHUB_009',
      detail: 'Service unavailable',
    });
  });

  it('reports a request GitHub never answered as upstream trouble', async () => {
    const failing = (async () => {
      throw new Error('The operation was aborted due to timeout');
    }) as unknown as GithubFetch;
    const adapter = new GithubRestAdapter(
      configWith(),
      new CapabilitiesService({ github_app: true }),
      failing,
    );

    // A timeout is never a 4xx, whatever the call site nominated for one.
    await expect(adapter.mintRepositoryToken(45678901, 831004242)).rejects.toMatchObject({
      code: 'GITHUB_009',
    });
  });
});

describe('listing an installation’s repositories', () => {
  it('follows every page GitHub offers', async () => {
    const { adapter, http } = build([
      TOKEN_ANSWER,
      {
        body: { total_count: 2, repositories: [REPOSITORY] },
        link: '<https://api.github.com/installation/repositories?per_page=100&page=2>; rel="next", <…>; rel="last"',
      },
      { body: { total_count: 2, repositories: [{ ...REPOSITORY, id: 2, name: 'two' }] } },
    ]);

    const repositories = await adapter.listInstallationRepositories(45678901);

    expect(repositories.map((r) => r.githubRepoId)).toEqual([831004242, 2]);
    expect(http.calls[1].url).toBe('https://api.github.com/installation/repositories?per_page=100');
    expect(http.calls[2].url).toContain('page=2');
    expect(repositories[0]).toMatchObject({
      fullName: 'acme-labs/oppenheimer',
      defaultBranch: 'main',
      pushedAt: '2026-09-18T10:00:00.000Z',
    });
  });

  it('stops when GitHub offers no next link', async () => {
    const { adapter, http } = build([
      TOKEN_ANSWER,
      { body: { total_count: 1, repositories: [REPOSITORY] }, link: '<…>; rel="last"' },
    ]);

    await adapter.listInstallationRepositories(45678901);

    expect(http.calls).toHaveLength(2);
  });
});

describe('listing a repository’s branches', () => {
  it('resolves the one repository by id, then reads its branches', async () => {
    const { adapter, http } = build([
      TOKEN_ANSWER,
      { body: REPOSITORY },
      {
        body: [
          { name: 'main', commit: { sha: 'aaa' }, protected: true },
          { name: 'feature', commit: { sha: 'bbb' } },
        ],
      },
    ]);

    const listing = await adapter.listRepositoryBranches(45678901, 831004242);

    // Three calls: a token, the repository, its branches. The installation's
    // whole repository set is never paginated to answer a question about one.
    expect(http.calls).toHaveLength(3);
    expect(http.calls[1].url).toBe('https://api.github.com/repositories/831004242');
    expect(http.calls[2].url).toBe(
      'https://api.github.com/repos/acme-labs/oppenheimer/branches?per_page=100',
    );
    expect(listing.defaultBranch).toBe('main');
    expect(listing.branches).toEqual([
      { name: 'main', commitSha: 'aaa', protected: true },
      { name: 'feature', commitSha: 'bbb', protected: false },
    ]);
  });

  it('reads GitHub’s 404 on that repository as “not in this installation”', async () => {
    const { adapter, http } = build([TOKEN_ANSWER, { status: 404 }]);

    await expect(adapter.listRepositoryBranches(45678901, 999)).rejects.toMatchObject({
      code: 'GITHUB_010',
    });
    // GitHub answers coverage; nothing rebuilds the allowlist in process to ask.
    expect(http.calls).toHaveLength(2);
  });
});

describe('the installation claim proof', () => {
  it('exchanges the code and reports what GitHub lists for that account', async () => {
    const { adapter, http } = build([
      { body: { access_token: 'gho_user' } },
      { body: { total_count: 1, installations: [INSTALLATION] } },
    ]);

    const visible = await adapter.listUserInstallations('the-oauth-code');

    expect(http.calls[0].url).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(String(http.calls[0].init.body))).toEqual({
      client_id: 'Iv1.abc',
      client_secret: 'shhh',
      code: 'the-oauth-code',
    });
    // The user token authenticates the listing, and never leaves this adapter.
    expect(headerOf(http.calls[1].init, 'authorization')).toBe('Bearer gho_user');
    // Visibility only. What the installation *is* comes from the App's own read.
    expect(visible).toEqual([{ githubInstallationId: 45678901 }]);
  });

  it('refuses a code GitHub rejects with a 200 and an error field', async () => {
    // The one failure that matters here does not come back as a 4xx, so a status
    // check alone would read it as success.
    const { adapter, http } = build([{ body: { error: 'bad_verification_code' } }]);

    await expect(adapter.listUserInstallations('stale')).rejects.toMatchObject({
      code: 'GITHUB_005',
    });
    expect(http.calls).toHaveLength(1);
  });

  it('reads the installation with the App JWT, suspension included', async () => {
    const { adapter, http } = build([
      { body: { ...INSTALLATION, suspended_at: '2026-09-19T09:00:00.000Z' } },
    ]);

    const claim = await adapter.readInstallation(45678901);

    expect(http.calls[0].url).toBe('https://api.github.com/app/installations/45678901');
    expect(claim).toEqual({
      githubInstallationId: 45678901,
      accountLogin: 'acme-labs',
      accountType: 'Organization',
      repositorySelection: 'selected',
      // The part a redirect cannot be trusted for.
      suspendedAt: new Date('2026-09-19T09:00:00.000Z'),
    });
  });

  it('refuses an installation GitHub describes without an account', async () => {
    // Inventing 'unknown' / 'Organization' here would put a fiction in a column
    // the console shows, and pass the aggregate's checks by luck of the string.
    await expect(
      build([{ body: { ...INSTALLATION, account: null } }]).adapter.readInstallation(45678901),
    ).rejects.toMatchObject({ code: 'GITHUB_009' });
    await expect(
      build([
        { body: { ...INSTALLATION, account: { login: 'acme-labs', type: 'Enterprise' } } },
      ]).adapter.readInstallation(45678901),
    ).rejects.toMatchObject({ code: 'GITHUB_009' });
  });
});
