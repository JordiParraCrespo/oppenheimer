import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type {
  GithubTokenRecord,
  GithubTokenRepositoryPort,
} from '../../database/github-token.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GithubTokenMapper } from '../../github-token.mapper';
import type {
  GithubTokenInspection,
  GithubTokensPort,
} from '../../infrastructure/github-tokens.port';
import type { UserTokenSealerPort } from '../../infrastructure/user-token-sealer.port';
import { GithubTokenResolver } from '../github-token.resolver';

/**
 * A person's own tokens (§6.2): what is kept when one is added or checked,
 * and which one reads a repository. The choice itself is
 * `token-key.policy.spec.ts`; this proves the resolver feeds it the person's
 * own tokens and pins, and that a secret is opened only into a credential.
 */
const NOW = new Date('2026-10-26T12:00:00Z');

const repository = (githubRepoId: number, fullName: string, archived = false) => ({
  githubRepoId,
  name: fullName.split('/')[1] as string,
  fullName,
  defaultBranch: 'main',
  private: true,
  archived,
});

function record(id: string, repositories: ReturnType<typeof repository>[]): GithubTokenRecord {
  return {
    id,
    userId: 'ana',
    label: id,
    kind: 'fine_grained',
    githubUserId: 583231,
    login: 'ana-dev',
    tokenSealed: Buffer.from(`sealed:${id}`),
    scopes: null,
    expiresAt: null,
    repositories,
    checkedAt: NOW,
    refusedAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  };
}

const INSPECTION: GithubTokenInspection = {
  kind: 'fine_grained',
  githubUserId: 583231,
  login: 'ana-dev',
  scopes: null,
  expiresAt: new Date('2027-01-24T00:00:00Z'),
  repositories: [{ ...repository(7, 'acme-labs/billing'), pushedAt: null }],
};

function build(
  options: {
    tokens?: GithubTokenRecord[];
    pins?: { githubRepoId: number; tokenId: string }[];
    inspect?: GithubTokensPort['inspect'];
    configured?: boolean;
  } = {},
) {
  const store = {
    findOwn: vi.fn().mockResolvedValue(options.tokens ?? []),
    findOneOwn: vi.fn(
      async (_userId: string, id: string) => options.tokens?.find((t) => t.id === id) ?? null,
    ),
    insert: vi.fn().mockResolvedValue({ id: 'new-token' }),
    relabel: vi.fn(),
    recordCheck: vi.fn().mockResolvedValue(true),
    recordRefusal: vi.fn(),
    delete: vi.fn(),
    findPins: vi.fn().mockResolvedValue(options.pins ?? []),
    pin: vi.fn(),
    unpin: vi.fn(),
  } satisfies GithubTokenRepositoryPort;
  const github = { inspect: vi.fn(options.inspect ?? (async () => INSPECTION)) };
  const sealer: UserTokenSealerPort = {
    isConfigured: () => options.configured ?? true,
    seal: (plaintext) => Buffer.from(`sealed:${plaintext}`),
    open: (sealed) => sealed.toString().replace(/^sealed:/, ''),
  };
  return {
    resolver: new GithubTokenResolver(store, github, sealer, new GithubTokenMapper()),
    store,
    github,
  };
}

const refused = () => new AppError(GithubErrors.TOKEN_REFUSED, { detail: 'Bad credentials' });

describe('adding a token', () => {
  it('keeps it sealed with what GitHub said it opens', async () => {
    const { resolver, store } = build();

    const id = await resolver.add('ana', 'acme: billing', 'github_pat_secret', NOW);

    expect(id).toBe('new-token');
    const kept = store.insert.mock.calls[0]?.[0];
    expect(kept?.tokenSealed.toString()).toBe('sealed:github_pat_secret');
    expect(kept?.repositories.map((r) => r.fullName)).toEqual(['acme-labs/billing']);
    expect(kept?.expiresAt).toEqual(INSPECTION.expiresAt);
  });

  it('keeps nothing from a token GitHub refuses', async () => {
    const { resolver, store } = build({ inspect: async () => Promise.reject(refused()) });

    await expect(resolver.add('ana', 'typo', 'ghp_nope', NOW)).rejects.toMatchObject({
      code: 'GITHUB_018',
    });
    expect(store.insert).not.toHaveBeenCalled();
  });

  it('refuses a label the person already uses, with GITHUB_020', async () => {
    const { resolver, store } = build();
    store.insert.mockResolvedValue('label_taken');

    await expect(resolver.add('ana', 'acme', 'github_pat_secret', NOW)).rejects.toMatchObject({
      code: 'GITHUB_020',
    });
  });

  it('refuses with GITHUB_021 and asks GitHub nothing when there is no key to seal with', async () => {
    const { resolver, github } = build({ configured: false });

    await expect(resolver.add('ana', 'acme', 'github_pat_secret', NOW)).rejects.toMatchObject({
      code: 'GITHUB_021',
    });
    expect(github.inspect).not.toHaveBeenCalled();
  });
});

describe('checking a token again', () => {
  // Marked refused, it stops being chosen; another token that opens the same
  // repositories reads them instead.
  it('marks a token GitHub now refuses, and answers the refusal', async () => {
    const { resolver, store } = build({
      tokens: [record('t1', [repository(7, 'acme-labs/billing')])],
      inspect: async () => Promise.reject(refused()),
    });

    await expect(resolver.recheck('ana', 't1', NOW)).rejects.toMatchObject({ code: 'GITHUB_018' });
    expect(store.recordRefusal).toHaveBeenCalledWith('ana', 't1', NOW);
    expect(store.recordCheck).not.toHaveBeenCalled();
  });

  it('is GITHUB_019 for a token that is not the person’s', async () => {
    const { resolver, github } = build();

    await expect(resolver.recheck('ana', 'someone-elses', NOW)).rejects.toMatchObject({
      code: 'GITHUB_019',
    });
    expect(github.inspect).not.toHaveBeenCalled();
  });
});

describe('pinning a token to a repository', () => {
  it('refuses, with GITHUB_023, a token that does not open the repository', async () => {
    const { resolver, store } = build({ tokens: [record('t1', [repository(7, 'acme/a')])] });

    await expect(resolver.pin('ana', 8, 't1')).rejects.toMatchObject({ code: 'GITHUB_023' });
    expect(store.pin).not.toHaveBeenCalled();
  });

  it('keeps the pin when the token opens the repository', async () => {
    const { resolver, store } = build({ tokens: [record('t1', [repository(7, 'acme/a')])] });

    await resolver.pin('ana', 7, 't1');

    expect(store.pin).toHaveBeenCalledWith('ana', { githubRepoId: 7, tokenId: 't1' });
  });
});

describe('the repositories a person’s tokens open', () => {
  it('lists each once, with the token that reads it, and leaves archived ones out', async () => {
    const orgWide = record('org-wide', [
      repository(1, 'acme/a'),
      repository(2, 'acme/b'),
      repository(3, 'acme/old', true),
    ]);
    const oneRepo = record('one-repo', [repository(2, 'acme/b')]);
    const { resolver } = build({ tokens: [orgWide, oneRepo] });

    const listed = await resolver.repositoriesOf('ana', NOW);

    expect(listed.map((r) => [r.fullName, r.tokenId])).toEqual([
      ['acme/a', 'org-wide'],
      ['acme/b', 'one-repo'],
    ]);
  });

  it('says which repository is read through a pin', async () => {
    const orgWide = record('org-wide', [repository(2, 'acme/b'), repository(1, 'acme/a')]);
    const oneRepo = record('one-repo', [repository(2, 'acme/b')]);
    const { resolver } = build({
      tokens: [orgWide, oneRepo],
      pins: [{ githubRepoId: 2, tokenId: 'org-wide' }],
    });

    const [b] = await resolver.repositoriesOf('ana', NOW);

    expect(b).toMatchObject({ fullName: 'acme/b', tokenId: 'org-wide', pinned: true });
  });
});

describe('the credential that reads a repository', () => {
  it('opens the chosen token, counts it against the person and caches under the token', async () => {
    const { resolver } = build({
      tokens: [
        record('org-wide', [repository(1, 'acme/a'), repository(2, 'acme/b')]),
        record('one-repo', [repository(2, 'acme/b')]),
      ],
    });

    expect(await resolver.credentialFor('ana', 2, NOW)).toMatchObject({
      token: 'one-repo',
      bucket: 'user:583231',
      cacheScope: 'token:one-repo',
    });
  });

  // GitHub revoking a token is found by a read, not by a check: marked there,
  // the next read is made with another token that opens the repository.
  it('marks the token refused when a read with it gets a 401', async () => {
    const { resolver, store } = build({ tokens: [record('t1', [repository(7, 'acme/a')])] });

    const credential = await resolver.credentialFor('ana', 7, NOW);
    await credential.onUnauthorized?.();

    expect(store.recordRefusal).toHaveBeenCalledWith('ana', 't1', expect.any(Date));
  });

  it('is GITHUB_023 when the only token that opened the repository was refused', async () => {
    const { resolver } = build({
      tokens: [{ ...record('t1', [repository(7, 'acme/a')]), refusedAt: NOW }],
    });

    await expect(resolver.credentialFor('ana', 7, NOW)).rejects.toMatchObject({
      code: 'GITHUB_023',
    });
  });
});
