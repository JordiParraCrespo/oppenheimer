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
import { GithubAccessResolver } from '../github-access.resolver';
import type { GithubTokenResolver } from '../github-token.resolver';
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
  fromFork: false,
};

it('keeps the refusal GitHub gave for a pull request it would not read, beside the ones it did', async () => {
  const { resolver, repository } = build({
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

  const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

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
  const resolver = new PullRequestAccessResolver(
    installations,
    app,
    withGraph as unknown as GithubPullsPort,
    grants,
    cache as unknown as CacheService,
    new GithubAccessResolver(
      installations,
      app,
      grants,
      cache as unknown as CacheService,
      tokens as GithubTokenResolver,
    ),
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
      ...BY_REST(),
      listPullRequests: vi.fn().mockResolvedValue([PULL]),
      readPullRequest: vi.fn().mockResolvedValue(PULL),
      listFiles: vi.fn().mockResolvedValue([{ path: 'src/auth/keychain.ts' }]),
      readChecks: vi.fn().mockRejectedValue(refused(403)),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

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
      ...BY_REST(),
      listPullRequests: vi.fn().mockRejectedValue(refused(404)),
    });

    await expect(resolver.openPullRequests(SCOPE, repository)).resolves.toMatchObject({
      snapshots: [],
      gaps: [{ what: 'repository', refusal: 'not_found' }],
    });
  });

  it('reads a rate limit as "wait", not as GitHub failing', async () => {
    const { resolver, repository } = build({
      ...BY_REST(),
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
    const { resolver, repository } = build({
      listOpenPullRequests: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 30 }, (_, i) => whole(i + 1))),
      readPullRequest,
      listFiles,
    });

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

    expect(read.snapshots).toHaveLength(30);
    expect(read.deferred).toBe(0);
    expect(read.gaps).toEqual([]);
    expect(readPullRequest).not.toHaveBeenCalled();
    expect(listFiles).not.toHaveBeenCalled();
  });

  it('reads a pull request whose files ran past the page the long way, without re-reading its detail', async () => {
    const readPullRequest = vi.fn();
    const listFiles = vi.fn().mockResolvedValue([{ path: 'a.ts' }, { path: 'b.ts' }]);
    const { resolver, repository } = build({
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

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

    const long = read.snapshots.find((snapshot) => snapshot.pull.number === 2);
    expect(long?.files).toEqual({ value: ['a.ts', 'b.ts'], refusal: null });
    expect(listFiles).toHaveBeenCalledTimes(1);
    expect(readPullRequest).not.toHaveBeenCalled();
  });

  it('keeps a part GitHub refused as that part’s gap, and the snapshot only briefly', async () => {
    const { resolver, repository, store } = build({
      listOpenPullRequests: vi
        .fn()
        .mockResolvedValue([{ ...whole(12), checks: { value: null, refusal: 'forbidden' } }]),
    });

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

    expect(read.snapshots).toHaveLength(1);
    expect(read.gaps).toEqual([{ what: 'checks', refusal: 'forbidden' }]);
    expect([...store.values()][0]?.ttl).toBe(15);
  });

  // A rate limit is GitHub saying "not now": asking REST instead would spend
  // the same installation's budget on the refusal.
  it('answers a rate limit as the repository’s gap and does not fall back to REST', async () => {
    const listPullRequests = vi.fn();
    const { resolver, repository } = build({
      listOpenPullRequests: vi
        .fn()
        .mockRejectedValue(
          new AppError(GithubErrors.RATE_LIMITED, { extensions: { upstreamStatus: 429 } }),
        ),
      listPullRequests,
    });

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

    expect(read.gaps).toEqual([{ what: 'repository', refusal: 'rate_limited' }]);
    expect(listPullRequests).not.toHaveBeenCalled();
  });

  it('falls back to the REST read when the GraphQL read fails', async () => {
    const { resolver, repository } = build({
      ...BY_REST(),
      listPullRequests: vi.fn().mockResolvedValue([PULL]),
      readPullRequest: vi.fn().mockResolvedValue(PULL),
      listFiles: vi.fn().mockResolvedValue([]),
      readChecks: vi.fn().mockResolvedValue(PASSING),
      listReviews: vi.fn().mockResolvedValue([]),
    });

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

    expect(read.snapshots.map((snapshot) => snapshot.pull.number)).toEqual([12]);
  });

  // Opening a pull request from the queue used to read all its parts again.
  it('leaves each snapshot where the pull request’s own screen finds it', async () => {
    const listFiles = vi.fn();
    const { resolver, repository } = build({
      listOpenPullRequests: vi.fn().mockResolvedValue([whole(12)]),
      readPullRequest: vi.fn().mockResolvedValue({ ...PULL, nodeId: 'PR_12' }),
      listFiles,
    });
    await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

    const snapshot = await resolver.pullRequest(SCOPE, {
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
      resolver.readBudget(),
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
    new PullRequestAccessResolver(
      {
        findAll: vi.fn().mockResolvedValue(installations),
      } as unknown as GithubInstallationRepositoryPort,
      {} as GithubAppPort,
      {} as GithubPullsPort,
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

  // GitHub answered `GET /user` with the token when it was added: it is theirs.
  it('is the login one of their own tokens belongs to, with no grant', async () => {
    const resolver = viewerResolver(null, [installation()], 'ana-dev');

    expect(await resolver.viewerLogin(SCOPE)).toBe('ana-dev');
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
    const readPullRequest = vi.fn(async (_t: string, _r: string, number: number) =>
      pullNumbered(number),
    );
    const pulls = Array.from({ length: count }, (_, i) => pullNumbered(i + 1));
    const { resolver, repository } = build({
      ...BY_REST(),
      listPullRequests: vi.fn().mockResolvedValue(pulls),
      readPullRequest,
      listFiles,
      readChecks,
      listReviews,
    });
    return { resolver, repository, listFiles, readChecks, listReviews, readPullRequest };
  }

  /**
   * The ceiling itself, so a change to it is a change to this line. Five pull
   * requests is four requests each: the detail, the files, the checks and the
   * reviews.
   */
  const BUDGET = 5;

  it('fills as many pull requests as the budget allows and says it is still filling', async () => {
    const { resolver, repository, listFiles } = budgeted(30);

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

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
    const { resolver, repository } = budgeted(30);

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

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
    const { resolver, repository, readPullRequest } = budgeted(30);

    await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());
    expect(readPullRequest).toHaveBeenCalledTimes(BUDGET);

    await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());
    // The first five are cached now, so the second read spends on the next
    // five and never re-reads the twenty-five it is still deferring.
    expect(readPullRequest).toHaveBeenCalledTimes(BUDGET * 2);
  });

  // An unasked part is not a refused one: it owes the reader no notice.
  it('reports no gap for a pull request it never asked about', async () => {
    const { resolver, repository } = budgeted(30);

    const read = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

    expect(read.gaps).toEqual([]);
  });

  // The budget is the view's: two repositories share it, or an account with
  // eighty of them has no ceiling at all.
  it('spends one budget across repositories', async () => {
    const { resolver, repository, listFiles } = budgeted(10);
    const second = { ...repository, githubRepoId: repository.githubRepoId + 1 };
    const budget = resolver.readBudget();

    await resolver.openPullRequests(SCOPE, repository, budget);
    await resolver.openPullRequests(SCOPE, second, budget);

    expect(listFiles).toHaveBeenCalledTimes(BUDGET);
  });

  // A pull request already in the cache is free, and never takes a place from
  // one that would cost a read: that is what lets the next view fill more.
  it('spends nothing on a pull request it has already filled', async () => {
    const { resolver, repository, listFiles } = budgeted(BUDGET);

    const first = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());
    const second = await resolver.openPullRequests(SCOPE, repository, resolver.readBudget());

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
    const { resolver, repository, listFiles } = budgeted(BUDGET);

    await Promise.all([
      resolver.openPullRequests(SCOPE, repository, resolver.readBudget()),
      resolver.openPullRequests(SCOPE, repository, resolver.readBudget()),
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
      installationId: built.repository.installationId,
      githubRepoId: 821374923,
      number: 12,
    };
    return { ...built, merge, address };
  }

  it('merges nothing, with GITHUB_014, once a push has moved the head on', async () => {
    const { resolver, merge, address } = forMerge();

    await expect(resolver.merge(SCOPE, 'ana', address, 'squash', 'abc')).rejects.toMatchObject({
      code: 'GITHUB_014',
    });
    expect(merge).not.toHaveBeenCalled();
  });

  it('merges at the head it was decided on while that is still the head', async () => {
    const { resolver, merge, address } = forMerge();

    await resolver.merge(SCOPE, 'ana', address, 'squash', 'def');

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
    repositoriesOf: vi.fn().mockResolvedValue([TOKEN_REPOSITORY]),
    credentialFor: vi.fn().mockResolvedValue({ token: 'github_pat_ana', bucket: 'user:1' }),
  });
  const address = { installationId: null, githubRepoId: 99, number: 5 };

  it('reads the pull request with the token that opens the repository', async () => {
    const readPullRequest = vi.fn().mockResolvedValue({ ...PULL, number: 5 });
    const { resolver } = build(
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

    const snapshot = await resolver.pullRequest(SCOPE, address);

    expect(snapshot.repository).toMatchObject({
      installationId: null,
      fullName: 'other-org/billing',
    });
    expect(readPullRequest).toHaveBeenCalledWith(
      { token: 'github_pat_ana', bucket: 'user:1' },
      'other-org/billing',
      5,
    );
  });

  it('merges nothing, with GITHUB_022, and asks GitHub nothing', async () => {
    const merge = vi.fn();
    const readPullRequest = vi.fn();
    const { resolver } = build(
      { merge, readPullRequest },
      { actorFor: vi.fn().mockResolvedValue({ token: 'gho_ana', githubUserId: 1 }) },
      tokens(),
    );

    await expect(resolver.merge(SCOPE, 'ana', address, 'squash')).rejects.toMatchObject({
      code: 'GITHUB_022',
    });
    expect(merge).not.toHaveBeenCalled();
    expect(readPullRequest).not.toHaveBeenCalled();
  });

  // Keyed by installation alone, a snapshot one person's token read was served
  // to anyone else whose token opened the same repository.
  it('never serves one person’s token read to another', async () => {
    const listFiles = vi.fn().mockResolvedValue([]);
    const credentialFor = vi
      .fn()
      .mockResolvedValueOnce({ token: 'github_pat_ana', bucket: 'user:1' })
      .mockResolvedValueOnce({ token: 'github_pat_bruno', bucket: 'user:2' });
    const { resolver } = build(
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

    await resolver.pullRequest(SCOPE, address);
    await resolver.pullRequest({ ...SCOPE, userId: 'bruno' } as AccessScope, address);

    expect(listFiles).toHaveBeenCalledTimes(2);
  });

  it('is GITHUB_023 for a repository none of the person’s tokens opens', async () => {
    const { resolver } = build({ readPullRequest: vi.fn() }, {}, tokens());

    await expect(
      resolver.pullRequest(SCOPE, { installationId: null, githubRepoId: 7, number: 1 }),
    ).rejects.toMatchObject({ code: 'GITHUB_023' });
  });
});
