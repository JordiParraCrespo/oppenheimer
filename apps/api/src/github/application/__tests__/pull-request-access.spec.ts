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
import { requireApp } from '../app-address.policy';
import { GithubAccessResolver } from '../github-access.resolver';
import type { GithubTokenResolver } from '../github-token.resolver';
import type { GithubUserGrantResolver } from '../github-user-grant.resolver';
import type { WorkspaceRepository } from '../pull-request-access.port';
import { PullRequestDirectoryResolver } from '../pull-request-directory.resolver';
import { PullRequestListingResolver } from '../pull-request-listing.resolver';
import { PullRequestReadResolver } from '../pull-request-read.resolver';
import { PullRequestSnapshotResolver } from '../pull-request-snapshot.resolver';
import { PullRequestSourceResolver } from '../pull-request-source.resolver';
import { PullRequestWriteResolver } from '../pull-request-write.resolver';

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
  fromFork: false,
};

it('keeps the refusal GitHub gave for a pull request it would not read, beside the ones it did', async () => {
  const { listings, repository } = build({
    ...BY_REST(),
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

  const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

  expect(read.snapshots.map((s) => s.pull.number)).toEqual([12]);
  expect(read.gaps).toEqual([{ what: 'pull_requests', refusal: 'forbidden' }]);
});

const refused = (status: number) =>
  new AppError(GithubErrors.UPSTREAM_FAILED, {
    detail: 'refused',
    extensions: { upstreamStatus: status },
  });

/** The GraphQL read failing, so the queue falls back to the REST read a spec is about. */
const BY_REST = () => ({ listOpenPullRequests: vi.fn().mockRejectedValue(refused(502)) });

function build(
  pulls: Partial<Record<keyof GithubPullsPort, unknown>>,
  userGrants: Partial<GithubUserGrantResolver> = {},
  tokens: Partial<GithubTokenResolver> = { isConfigured: () => false },
) {
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
  const installations = {
    findOneById: vi.fn().mockResolvedValue(Some(connected)),
  } as unknown as GithubInstallationRepositoryPort;
  const app = {
    mintInstallationToken: vi
      .fn()
      .mockResolvedValue({ token: 'ghs_read', expiresAt: new Date(Date.now() + 3_600_000) }),
    listInstallationRepositories: vi.fn().mockResolvedValue([
      {
        githubRepoId: 821374923,
        name: 'xrp',
        fullName: 'acme-labs/xrp',
        defaultBranch: 'main',
        private: true,
      },
    ]),
  } as unknown as GithubAppPort;
  const grants = userGrants as GithubUserGrantResolver;
  // The GraphQL read is the queue's: it answers nothing unless a spec gives it
  // something, and a spec about the REST read says so with `BY_REST`.
  const withGraph = { listOpenPullRequests: vi.fn().mockResolvedValue([]), ...pulls };
  const port = withGraph as unknown as GithubPullsPort;
  const redis = cache as unknown as CacheService;
  const access = new GithubAccessResolver(
    installations,
    app,
    grants,
    redis,
    tokens as GithubTokenResolver,
  );
  // One snapshot resolver behind both reads, as the module binds it: the queue
  // and a pull request's own screen share its cache keys and its single flight.
  const snapshots = new PullRequestSnapshotResolver(port, redis);
  const listings = new PullRequestListingResolver(
    redis,
    new PullRequestSourceResolver(port, redis, access),
    snapshots,
  );
  const reads = new PullRequestReadResolver(port, redis, access, snapshots);
  const writes = new PullRequestWriteResolver(port, redis, access);
  const repository: WorkspaceRepository = {
    kind: 'installation',
    installationId: connected.id,
    githubRepoId: 821374923,
    name: 'xrp',
    fullName: 'acme-labs/xrp',
    defaultBranch: 'main',
    private: true,
  };
  return { listings, reads, writes, repository, store };
}

describe('a pull request GitHub answers only in part', () => {
  it('keeps the pull request, its files and reviews when its checks are refused, and says why', async () => {
    const { listings, repository, store } = build({
      ...BY_REST(),
      listPullRequests: vi.fn().mockResolvedValue([PULL]),
      readPullRequest: vi.fn().mockResolvedValue(PULL),
      listFiles: vi.fn().mockResolvedValue([{ path: 'src/auth/keychain.ts' }]),
      readChecks: vi.fn().mockRejectedValue(refused(403)),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(read.snapshots).toHaveLength(1);
    const [snapshot] = read.snapshots;
    expect(snapshot?.files).toEqual({ value: ['src/auth/keychain.ts'], refusal: null });
    expect(snapshot?.checks).toEqual({ value: null, refusal: 'forbidden' });
    expect(read.gaps).toEqual([{ what: 'checks', refusal: 'forbidden' }]);
    // Kept only briefly, so the next read asks GitHub again.
    expect([...store.values()][0]?.ttl).toBe(15);
  });

  it('names a repository whose listing GitHub refuses instead of failing the read', async () => {
    const { listings, repository } = build({
      ...BY_REST(),
      listPullRequests: vi.fn().mockRejectedValue(refused(404)),
    });

    await expect(listings.openPullRequests(SCOPE, repository)).resolves.toMatchObject({
      snapshots: [],
      gaps: [{ what: 'repository', refusal: 'not_found' }],
    });
  });

  it('reads a rate limit as "wait", not as GitHub failing', async () => {
    const { listings, repository } = build({
      ...BY_REST(),
      listPullRequests: vi
        .fn()
        .mockRejectedValue(
          new AppError(GithubErrors.RATE_LIMITED, { extensions: { upstreamStatus: 429 } }),
        ),
    });

    await expect(listings.openPullRequests(SCOPE, repository)).resolves.toMatchObject({
      gaps: [{ what: 'repository', refusal: 'rate_limited' }],
    });
  });
});

/**
 * The queue was slow because every open pull request cost four requests on
 * top of the listing, five filled per view and the rest on later polls. One
 * GraphQL read now answers them all with their parts; only a pull request
 * longer than that read's page is read the long way.
 */
describe('the open pull requests read in one request', () => {
  const PASSING = { state: 'passing' as const, total: 1, passed: 1, failed: 0, pending: 0 };
  const whole = (number: number) => ({
    pull: { ...PULL, number, nodeId: `PR_${number}` },
    files: { value: ['src/auth/keychain.ts'], refusal: null },
    checks: { value: PASSING, refusal: null },
    reviews: { value: [], refusal: null },
  });

  it('answers every pull request whole on the first read, asking nothing per pull request', async () => {
    const readPullRequest = vi.fn();
    const listFiles = vi.fn();
    const { listings, repository } = build({
      listOpenPullRequests: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 30 }, (_, i) => whole(i + 1))),
      readPullRequest,
      listFiles,
    });

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(read.snapshots).toHaveLength(30);
    expect(read.deferred).toBe(0);
    expect(read.gaps).toEqual([]);
    expect(readPullRequest).not.toHaveBeenCalled();
    expect(listFiles).not.toHaveBeenCalled();
  });

  it('reads a pull request whose files ran past the page the long way, without re-reading its detail', async () => {
    const readPullRequest = vi.fn();
    const listFiles = vi.fn().mockResolvedValue([{ path: 'a.ts' }, { path: 'b.ts' }]);
    const { listings, repository } = build({
      listOpenPullRequests: vi
        .fn()
        .mockResolvedValue([
          whole(1),
          { ...whole(2), files: { value: null, refusal: 'past_page' } },
        ]),
      readPullRequest,
      listFiles,
      readChecks: vi.fn().mockResolvedValue(PASSING),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    const long = read.snapshots.find((snapshot) => snapshot.pull.number === 2);
    expect(long?.files).toEqual({ value: ['a.ts', 'b.ts'], refusal: null });
    expect(listFiles).toHaveBeenCalledTimes(1);
    expect(readPullRequest).not.toHaveBeenCalled();
  });

  it('keeps a part GitHub refused as that part’s gap, and the snapshot only briefly', async () => {
    const { listings, repository, store } = build({
      listOpenPullRequests: vi
        .fn()
        .mockResolvedValue([{ ...whole(12), checks: { value: null, refusal: 'forbidden' } }]),
    });

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(read.snapshots).toHaveLength(1);
    expect(read.gaps).toEqual([{ what: 'checks', refusal: 'forbidden' }]);
    expect([...store.values()][0]?.ttl).toBe(15);
  });

  // A rate limit is GitHub saying "not now": asking REST instead would spend
  // the same installation's budget on the refusal.
  it('answers a rate limit as the repository’s gap and does not fall back to REST', async () => {
    const listPullRequests = vi.fn();
    const { listings, repository } = build({
      listOpenPullRequests: vi
        .fn()
        .mockRejectedValue(
          new AppError(GithubErrors.RATE_LIMITED, { extensions: { upstreamStatus: 429 } }),
        ),
      listPullRequests,
    });

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(read.gaps).toEqual([{ what: 'repository', refusal: 'rate_limited' }]);
    expect(listPullRequests).not.toHaveBeenCalled();
  });

  it('falls back to the REST read when the GraphQL read fails', async () => {
    const { listings, repository } = build({
      ...BY_REST(),
      listPullRequests: vi.fn().mockResolvedValue([PULL]),
      readPullRequest: vi.fn().mockResolvedValue(PULL),
      listFiles: vi.fn().mockResolvedValue([]),
      readChecks: vi.fn().mockResolvedValue(PASSING),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(read.snapshots.map((snapshot) => snapshot.pull.number)).toEqual([12]);
  });

  // Opening a pull request from the queue used to read all its parts again.
  it('leaves each snapshot where the pull request’s own screen finds it', async () => {
    const listFiles = vi.fn();
    const { listings, reads, repository } = build({
      listOpenPullRequests: vi.fn().mockResolvedValue([whole(12)]),
      readPullRequest: vi.fn().mockResolvedValue({ ...PULL, nodeId: 'PR_12' }),
      listFiles,
    });
    await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    const snapshot = await reads.pullRequest(SCOPE, {
      kind: 'installation' as const,
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
      number: 12,
    });

    expect(snapshot.files.value).toEqual(['src/auth/keychain.ts']);
    expect(listFiles).not.toHaveBeenCalled();
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
    const { listings, repository } = build({
      listPullRequests: vi.fn().mockResolvedValue(closed),
      readPullRequest,
      listFiles: vi.fn().mockResolvedValue([]),
      readChecks: vi
        .fn()
        .mockResolvedValue({ state: 'passing', total: 1, passed: 1, failed: 0, pending: 0 }),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const { pulls, complete } = await listings.closedPullRequests(
      SCOPE,
      [repository],
      new Date('2026-09-01T00:00:00Z'),
      2,
      listings.readBudget(),
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
  const viewerResolver = (
    grantLogin: string | null,
    installations: GithubInstallationEntity[],
    tokenLogin: string | null = null,
  ) =>
    new PullRequestDirectoryResolver(
      {
        findAll: vi.fn().mockResolvedValue(installations),
      } as unknown as GithubInstallationRepositoryPort,
      {} as GithubAppPort,
      { loginOf: vi.fn().mockResolvedValue(grantLogin) } as unknown as GithubUserGrantResolver,
      {} as CacheService,
      {
        tokenLogin: vi.fn().mockResolvedValue(tokenLogin),
      } as unknown as GithubAccessResolver,
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
    const directory = viewerResolver('ana-dev', [personal('ana')]);

    expect(await directory.viewerLogin(SCOPE)).toBe('ana-dev');
  });

  // GitHub lets nobody but the account install an App on a user account, so the
  // personal installation this person connected is this person.
  it('is the account of a personal installation they connected, with no grant', async () => {
    const directory = viewerResolver(null, [personal('ana')]);

    expect(await directory.viewerLogin(SCOPE)).toBe('ana-dev');
  });

  it('is nobody when the only installation is an organization’s', async () => {
    const directory = viewerResolver(null, [installation()]);

    expect(await directory.viewerLogin(SCOPE)).toBeNull();
  });

  // GitHub answered `GET /user` with the token when it was added: it is theirs.
  it('is the login one of their own tokens belongs to, with no grant', async () => {
    const directory = viewerResolver(null, [installation()], 'ana-dev');

    expect(await directory.viewerLogin(SCOPE)).toBe('ana-dev');
  });

  // Another person's personal installation says who *they* are, never who asked.
  it('is nobody when the personal installation is somebody else’s', async () => {
    const directory = viewerResolver(null, [personal('bruno')]);

    expect(await directory.viewerLogin(SCOPE)).toBeNull();
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
    const readPullRequest = vi.fn(async (_t: string, _r: string, number: number) =>
      pullNumbered(number),
    );
    const pulls = Array.from({ length: count }, (_, i) => pullNumbered(i + 1));
    const { listings, repository } = build({
      ...BY_REST(),
      listPullRequests: vi.fn().mockResolvedValue(pulls),
      readPullRequest,
      listFiles,
      readChecks,
      listReviews,
    });
    return { listings, repository, listFiles, readChecks, listReviews, readPullRequest };
  }

  /**
   * The ceiling itself, so a change to it is a change to this line. Five pull
   * requests is four requests each: the detail, the files, the checks and the
   * reviews.
   */
  const BUDGET = 5;

  it('fills as many pull requests as the budget allows and says it is still filling', async () => {
    const { listings, repository, listFiles } = budgeted(30);

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(read.snapshots).toHaveLength(BUDGET);
    expect(listFiles).toHaveBeenCalledTimes(BUDGET);
    expect(read.deferred).toBe(30 - BUDGET);
  });

  /**
   * A pull request this read cannot fill is left out rather than returned with
   * empty parts: a row with no files, checks or reviews read would show a
   * lane, a checks state and a blocker nobody read (#244).
   */
  it('leaves a pull request out rather than answering with parts nobody read', async () => {
    const { listings, repository } = budgeted(30);

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    for (const snapshot of read.snapshots) {
      expect(snapshot.files.value).not.toBeNull();
      expect(snapshot.checks.value).not.toBeNull();
      expect(snapshot.reviews.value).not.toBeNull();
    }
  });

  /**
   * The regression that made this worth rewriting: a deferred pull request
   * used to be read for its detail anyway and the result thrown away uncached,
   * so every `pullRequestsFilling` tick paid one request for every row it had
   * not filled yet — the fan-out the budget exists to stop.
   */
  it('does not read the detail of a pull request it defers, on this poll or the next', async () => {
    const { listings, repository, readPullRequest } = budgeted(30);

    await listings.openPullRequests(SCOPE, repository, listings.readBudget());
    expect(readPullRequest).toHaveBeenCalledTimes(BUDGET);

    await listings.openPullRequests(SCOPE, repository, listings.readBudget());
    // The first five are cached now, so the second read spends on the next
    // five and never re-reads the twenty-five it is still deferring.
    expect(readPullRequest).toHaveBeenCalledTimes(BUDGET * 2);
  });

  // An unasked part is not a refused one: it owes the reader no notice.
  it('reports no gap for a pull request it never asked about', async () => {
    const { listings, repository } = budgeted(30);

    const read = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(read.gaps).toEqual([]);
  });

  // The budget is the view's: two repositories share it, or an account with
  // eighty of them has no ceiling at all.
  it('spends one budget across repositories', async () => {
    const { listings, repository, listFiles } = budgeted(10);
    const second = { ...repository, githubRepoId: repository.githubRepoId + 1 };
    const budget = listings.readBudget();

    await listings.openPullRequests(SCOPE, repository, budget);
    await listings.openPullRequests(SCOPE, second, budget);

    expect(listFiles).toHaveBeenCalledTimes(BUDGET);
  });

  // A pull request already in the cache is free, and never takes a place from
  // one that would cost a read: that is what lets the next view fill more.
  it('spends nothing on a pull request it has already filled', async () => {
    const { listings, repository, listFiles } = budgeted(BUDGET);

    const first = await listings.openPullRequests(SCOPE, repository, listings.readBudget());
    const second = await listings.openPullRequests(SCOPE, repository, listings.readBudget());

    expect(first.snapshots).toHaveLength(BUDGET);
    expect(second.snapshots).toHaveLength(BUDGET);
    expect(second.deferred).toBe(0);
    expect(listFiles).toHaveBeenCalledTimes(BUDGET);
  });

  /**
   * Two overlapping polls used to both miss the cache and both spend on the
   * same pull request, because `get` → read → `set` is not single-flight.
   */
  it('reads a pull request once when two polls overlap', async () => {
    const { listings, repository, listFiles } = budgeted(BUDGET);

    await Promise.all([
      listings.openPullRequests(SCOPE, repository, listings.readBudget()),
      listings.openPullRequests(SCOPE, repository, listings.readBudget()),
    ]);

    expect(listFiles).toHaveBeenCalledTimes(BUDGET);
  });
});

describe('a merge pinned to the head it was decided on', () => {
  function forMerge() {
    const merge = vi.fn().mockResolvedValue(undefined);
    const built = build(
      { readPullRequest: vi.fn().mockResolvedValue({ ...PULL, headSha: 'def' }), merge },
      // The write is made with the caller's own token.
      { actorFor: vi.fn().mockResolvedValue({ token: 'gho_ana', githubUserId: 1 }) },
    );
    const address = {
      kind: 'installation' as const,
      installationId: built.repository.installationId,
      githubRepoId: 821374923,
      number: 12,
    };
    return { ...built, merge, address };
  }

  it('merges nothing, with GITHUB_014, once a push has moved the head on', async () => {
    const { writes, merge, address } = forMerge();

    await expect(writes.merge(SCOPE, 'ana', address, 'squash', 'abc')).rejects.toMatchObject({
      code: 'GITHUB_014',
    });
    expect(merge).not.toHaveBeenCalled();
  });

  it('merges at the head it was decided on while that is still the head', async () => {
    const { writes, merge, address } = forMerge();

    await writes.merge(SCOPE, 'ana', address, 'squash', 'def');

    expect(merge).toHaveBeenCalledWith(
      { token: 'gho_ana', bucket: 'user:1' },
      'acme-labs/xrp',
      12,
      'squash',
      'def',
    );
  });
});

/**
 * A repository the App is not on, read through the person's own token (§6.2):
 * its address has no installation, it reads with the token that opens it, and
 * nothing is written to it in anyone's name.
 */
describe('a repository read through the person’s own token', () => {
  const TOKEN_REPOSITORY = {
    githubRepoId: 99,
    name: 'billing',
    fullName: 'other-org/billing',
    defaultBranch: 'main',
    private: true,
    tokenId: 't1',
    pinned: false,
  };
  const tokens = (): Partial<GithubTokenResolver> => ({
    isConfigured: () => true,
    repositoryOf: vi.fn(async (_userId: string, githubRepoId: number) => {
      if (githubRepoId === TOKEN_REPOSITORY.githubRepoId) return TOKEN_REPOSITORY;
      throw new AppError(GithubErrors.NO_TOKEN_FOR_REPOSITORY, { detail: 'none' });
    }),
    credentialFor: vi.fn().mockResolvedValue({ token: 'github_pat_ana', bucket: 'user:1' }),
  });
  const address = { kind: 'tokens' as const, githubRepoId: 99, number: 5 };

  it('reads the pull request with the token that opens the repository', async () => {
    const readPullRequest = vi.fn().mockResolvedValue({ ...PULL, number: 5 });
    const { reads } = build(
      {
        readPullRequest,
        listFiles: vi.fn().mockResolvedValue([]),
        readChecks: vi
          .fn()
          .mockResolvedValue({ state: 'none', total: 0, passed: 0, failed: 0, pending: 0 }),
        listReviews: vi.fn().mockResolvedValue([]),
      },
      {},
      tokens(),
    );

    const snapshot = await reads.pullRequest(SCOPE, address);

    expect(snapshot.repository).toMatchObject({ kind: 'tokens', fullName: 'other-org/billing' });
    expect(readPullRequest).toHaveBeenCalledWith(
      { token: 'github_pat_ana', bucket: 'user:1' },
      'other-org/billing',
      5,
    );
  });

  // Keyed by installation alone, a snapshot one token read was served to any
  // other read of the repository, even another token of the same GitHub
  // account that cannot see its checks.
  it('never serves one token’s read to another, even of the same GitHub account', async () => {
    const listFiles = vi.fn().mockResolvedValue([]);
    const credentialFor = vi
      .fn()
      .mockResolvedValueOnce({ token: 'github_pat_a', bucket: 'user:1', cacheScope: 'token:a' })
      .mockResolvedValueOnce({ token: 'github_pat_b', bucket: 'user:1', cacheScope: 'token:b' });
    const { reads } = build(
      {
        readPullRequest: vi.fn().mockResolvedValue({ ...PULL, number: 5 }),
        listFiles,
        readChecks: vi
          .fn()
          .mockResolvedValue({ state: 'none', total: 0, passed: 0, failed: 0, pending: 0 }),
        listReviews: vi.fn().mockResolvedValue([]),
      },
      {},
      { ...tokens(), credentialFor },
    );

    await reads.pullRequest(SCOPE, address);
    await reads.pullRequest({ ...SCOPE, userId: 'bruno' } as AccessScope, address);

    expect(listFiles).toHaveBeenCalledTimes(2);
  });

  // A review session clones through the App, which a token repository has none of.
  it('gives no installation to start a session on, with GITHUB_022', () => {
    expect(() => requireApp(address)).toThrow(
      expect.objectContaining({
        code: 'GITHUB_022',
        detail: 'Repository 99 is read through your own GitHub token.',
      }),
    );
    const app = { ...address, kind: 'installation' as const, installationId: 'inst' };
    expect(requireApp(app)).toBe(app);
  });

  it('is GITHUB_023 for a repository none of the person’s tokens opens', async () => {
    const { reads } = build({ readPullRequest: vi.fn() }, {}, tokens());

    await expect(
      reads.pullRequest(SCOPE, { kind: 'tokens', githubRepoId: 7, number: 1 }),
    ).rejects.toMatchObject({ code: 'GITHUB_023' });
  });
});
