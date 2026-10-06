import type { AccessScope } from '@oppenheimer/backend-authz';
import type { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GithubInstallationEntity } from '../../domain/github-installation.entity';
import type { GithubAppPort } from '../../infrastructure/github-app.port';
import type { GithubPullsPort } from '../../infrastructure/github-pulls.port';
import type { GithubUserGrantResolver } from '../github-user-grant.resolver';
import type { WorkspaceRepository } from '../pull-request-access.port';
import { PullRequestAccessResolver } from '../pull-request-access.resolver';

/**
 * #244: one repository's checks refused with a 403 took the whole queue down
 * to an error card. A refused part costs that part, a refused repository
 * costs that repository, and a snapshot missing a part is not kept as if it
 * were whole.
 */
const SCOPE = { userId: 'ana', organizationId: 'org-acme' } as unknown as AccessScope;

function installation() {
  return GithubInstallationEntity.connect({
    organizationId: 'org-acme',
    githubInstallationId: 45678901,
    accountLogin: 'acme-labs',
    accountType: 'Organization',
    repositorySelection: 'all',
    installedByUserId: 'ana',
    suspendedAt: null,
  });
}

const PULL = {
  number: 12,
  title: 'Store wallet tokens in the Keychain',
  htmlUrl: 'https://github.com/acme-labs/xrp/pull/12',
  authorLogin: 'ana',
  draft: false,
  state: 'open' as const,
  merged: false,
  mergedAt: null,
  headRef: 'oppenheimer/keychain',
  headSha: 'abc',
  baseRef: 'main',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  closedAt: null,
  requestedReviewers: [],
  body: '',
  additions: 10,
  deletions: 2,
  changedFiles: 1,
  mergeable: true,
  mergeableState: 'clean',
};

it('keeps the refusal GitHub gave for a pull request it would not read, beside the ones it did', async () => {
  const { resolver, repository } = build({
    listPullRequests: vi.fn().mockResolvedValue([PULL, { ...PULL, number: 13 }]),
    readPullRequest: vi.fn(async (_t: string, _r: string, number: number) => {
      if (number === 13) throw refused(403);
      return PULL;
    }),
    listFiles: vi.fn().mockResolvedValue([]),
    readChecks: vi
      .fn()
      .mockResolvedValue({ state: 'passing', total: 1, passed: 1, failed: 0, pending: 0 }),
    listReviews: vi.fn().mockResolvedValue([]),
  });

  const read = await resolver.openPullRequests(SCOPE, repository);

  expect(read.snapshots.map((s) => s.pull.number)).toEqual([12]);
  expect(read.gaps).toEqual([{ what: 'pull_requests', refusal: 'forbidden' }]);
});

const refused = (status: number) =>
  new AppError(GithubErrors.UPSTREAM_FAILED, {
    detail: 'refused',
    extensions: { upstreamStatus: status },
  });

function build(pulls: Partial<Record<keyof GithubPullsPort, unknown>>) {
  const connected = installation();
  const store = new Map<string, { value: unknown; ttl?: number }>();
  const cache = {
    get: vi.fn(async (key: string) => store.get(key)?.value),
    set: vi.fn(
      async (key: string, value: unknown, ttl?: number) => void store.set(key, { value, ttl }),
    ),
    getOrSet: vi.fn(async (_key: string, _ttl: number, load: () => Promise<unknown>) => load()),
    del: vi.fn(),
  };
  const resolver = new PullRequestAccessResolver(
    {
      findOneById: vi.fn().mockResolvedValue(Some(connected)),
    } as unknown as GithubInstallationRepositoryPort,
    {
      mintInstallationToken: vi
        .fn()
        .mockResolvedValue({ token: 'ghs_read', expiresAt: new Date(Date.now() + 3_600_000) }),
    } as unknown as GithubAppPort,
    pulls as unknown as GithubPullsPort,
    {} as GithubUserGrantResolver,
    cache as unknown as CacheService,
  );
  const repository: WorkspaceRepository = {
    installationId: connected.id,
    githubRepoId: 821374923,
    name: 'xrp',
    fullName: 'acme-labs/xrp',
    defaultBranch: 'main',
    private: true,
  };
  return { resolver, repository, store };
}

describe('a pull request GitHub answers only in part', () => {
  it('keeps the pull request, its files and reviews when its checks are refused, and says why', async () => {
    const { resolver, repository, store } = build({
      listPullRequests: vi.fn().mockResolvedValue([PULL]),
      readPullRequest: vi.fn().mockResolvedValue(PULL),
      listFiles: vi.fn().mockResolvedValue([{ path: 'src/auth/keychain.ts' }]),
      readChecks: vi.fn().mockRejectedValue(refused(403)),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const read = await resolver.openPullRequests(SCOPE, repository);

    expect(read.snapshots).toHaveLength(1);
    const [snapshot] = read.snapshots;
    expect(snapshot?.files).toEqual({ value: ['src/auth/keychain.ts'], refusal: null });
    expect(snapshot?.checks).toEqual({ value: null, refusal: 'forbidden' });
    expect(read.gaps).toEqual([{ what: 'checks', refusal: 'forbidden' }]);
    // Kept only briefly, so the next read asks GitHub again.
    expect([...store.values()][0]?.ttl).toBe(15);
  });

  it('names a repository whose listing GitHub refuses instead of failing the read', async () => {
    const { resolver, repository } = build({
      listPullRequests: vi.fn().mockRejectedValue(refused(404)),
    });

    await expect(resolver.openPullRequests(SCOPE, repository)).resolves.toMatchObject({
      snapshots: [],
      gaps: [{ what: 'repository', refusal: 'not_found' }],
    });
  });

  it('reads a rate limit as "wait", not as GitHub failing', async () => {
    const { resolver, repository } = build({
      listPullRequests: vi
        .fn()
        .mockRejectedValue(
          new AppError(GithubErrors.RATE_LIMITED, { extensions: { upstreamStatus: 429 } }),
        ),
    });

    await expect(resolver.openPullRequests(SCOPE, repository)).resolves.toMatchObject({
      gaps: [{ what: 'repository', refusal: 'rate_limited' }],
    });
  });
});

describe('the closed pull requests Analytics reads', () => {
  it('reads only the most recently closed up to the ceiling, and says the answer is not complete', async () => {
    const closed = Array.from({ length: 5 }, (_, i) => ({
      ...PULL,
      number: 100 + i,
      state: 'closed' as const,
      closedAt: `2026-10-0${i + 1}T00:00:00Z`,
      updatedAt: `2026-10-0${i + 1}T00:00:00Z`,
    }));
    const readPullRequest = vi.fn(async (_t: string, _r: string, number: number) => ({
      ...PULL,
      number,
    }));
    const { resolver, repository } = build({
      listPullRequests: vi.fn().mockResolvedValue(closed),
      readPullRequest,
      listFiles: vi.fn().mockResolvedValue([]),
      readChecks: vi
        .fn()
        .mockResolvedValue({ state: 'passing', total: 1, passed: 1, failed: 0, pending: 0 }),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const { pulls, complete } = await resolver.closedPullRequests(
      SCOPE,
      [repository],
      new Date('2026-09-01T00:00:00Z'),
      2,
    );

    expect(complete).toBe(false);
    expect(pulls[0]?.snapshots.map((s) => s.pull.number).sort()).toEqual([103, 104]);
    expect(readPullRequest).toHaveBeenCalledTimes(2);
  });
});

/**
 * Who the reader is on GitHub decides whether a pull request is theirs, asked
 * of them, or merely watched. Without it every row falls to `watching` and the
 * queue opens on an empty Mine, which is what an account whose installation
 * predates the stored user grant saw.
 */
describe('who the reader is on GitHub', () => {
  const viewerResolver = (grantLogin: string | null, installations: GithubInstallationEntity[]) =>
    new PullRequestAccessResolver(
      {
        findAll: vi.fn().mockResolvedValue(installations),
      } as unknown as GithubInstallationRepositoryPort,
      {} as GithubAppPort,
      {} as GithubPullsPort,
      { loginOf: vi.fn().mockResolvedValue(grantLogin) } as unknown as GithubUserGrantResolver,
      {} as CacheService,
    );

  const personal = (installedByUserId: string) =>
    GithubInstallationEntity.connect({
      organizationId: 'org-acme',
      githubInstallationId: 11,
      accountLogin: 'ana-dev',
      accountType: 'User',
      repositorySelection: 'all',
      installedByUserId,
      suspendedAt: null,
    });

  it('is the login their stored grant carries', async () => {
    const resolver = viewerResolver('ana-dev', [personal('ana')]);

    expect(await resolver.viewerLogin(SCOPE)).toBe('ana-dev');
  });

  // GitHub lets nobody but the account install an App on a user account, so the
  // personal installation this person connected is this person.
  it('is the account of a personal installation they connected, with no grant', async () => {
    const resolver = viewerResolver(null, [personal('ana')]);

    expect(await resolver.viewerLogin(SCOPE)).toBe('ana-dev');
  });

  it('is nobody when the only installation is an organization’s', async () => {
    const resolver = viewerResolver(null, [installation()]);

    expect(await resolver.viewerLogin(SCOPE)).toBeNull();
  });

  // Another person's personal installation says who *they* are, never who asked.
  it('is nobody when the personal installation is somebody else’s', async () => {
    const resolver = viewerResolver(null, [personal('bruno')]);

    expect(await resolver.viewerLogin(SCOPE)).toBeNull();
  });
});

/**
 * #247: one page view asked GitHub for five requests times every pull request
 * it found — on a real account, hundreds in a burst, which GitHub answers with
 * a secondary rate limit. A view now spends a budget: every pull request comes
 * back, as many as the budget allows with their parts filled, and the next
 * read fills more from a cache that keeps what it already has.
 */
describe('what one read spends', () => {
  const pullNumbered = (number: number) => ({ ...PULL, number });

  function budgeted(count: number) {
    const listFiles = vi.fn().mockResolvedValue([]);
    const readChecks = vi
      .fn()
      .mockResolvedValue({ state: 'passing', total: 1, passed: 1, failed: 0, pending: 0 });
    const listReviews = vi.fn().mockResolvedValue([]);
    const pulls = Array.from({ length: count }, (_, i) => pullNumbered(i + 1));
    const { resolver, repository } = build({
      listPullRequests: vi.fn().mockResolvedValue(pulls),
      readPullRequest: vi.fn(async (_t: string, _r: string, number: number) =>
        pullNumbered(number),
      ),
      listFiles,
      readChecks,
      listReviews,
    });
    return { resolver, repository, listFiles, readChecks, listReviews };
  }

  it('draws every pull request, and fills the parts of as many as the budget allows', async () => {
    const { resolver, repository, listFiles } = budgeted(30);

    const read = await resolver.openPullRequests(SCOPE, repository, { left: 12 });

    expect(read.snapshots).toHaveLength(30);
    expect(listFiles).toHaveBeenCalledTimes(12);
    const filled = read.snapshots.filter((s) => s.files.value !== null);
    expect(filled).toHaveLength(12);
  });

  // An unasked part is not a refused one: it owes the reader no notice.
  it('reports no gap for a part it never asked for', async () => {
    const { resolver, repository } = budgeted(30);

    const read = await resolver.openPullRequests(SCOPE, repository, { left: 1 });

    expect(read.gaps).toEqual([]);
  });

  // The budget is the view's: two repositories share it, or an account with
  // eighty of them has no ceiling at all.
  it('spends one budget across repositories', async () => {
    const { resolver, repository, listFiles } = budgeted(10);
    const second = { ...repository, githubRepoId: repository.githubRepoId + 1 };
    const budget = { left: 12 };

    await resolver.openPullRequests(SCOPE, repository, budget);
    await resolver.openPullRequests(SCOPE, second, budget);

    expect(listFiles).toHaveBeenCalledTimes(12);
  });

  // A pull request already in the cache is free, and never takes a place from
  // one that would cost a read: that is what lets the next view fill more.
  it('spends nothing on a pull request it has already filled', async () => {
    const { resolver, repository, listFiles } = budgeted(10);

    await resolver.openPullRequests(SCOPE, repository, { left: 12 });
    await resolver.openPullRequests(SCOPE, repository, { left: 12 });

    expect(listFiles).toHaveBeenCalledTimes(10);
  });
});
