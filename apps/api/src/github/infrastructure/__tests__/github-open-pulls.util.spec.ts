import { describe, expect, it } from 'vitest';
import { type OpenPullsBody, openPullRequestsOf } from '../github-open-pulls.util';

/**
 * The queue's one GraphQL read, turned into what the REST read used to give.
 * The rows are drawn from the same fields, so a value read differently here
 * (a bot's login, a merge state, a check counted twice) sorts a pull request
 * into the wrong scope or lane without anything failing. The resolver's spec
 * covers what the queue does with the answer.
 */
function node(overrides: Record<string, unknown> = {}) {
  return {
    id: 'PR_kwDO',
    number: 12,
    title: 'Store wallet tokens in the Keychain',
    url: 'https://github.com/acme-labs/xrp/pull/12',
    body: null,
    isDraft: false,
    state: 'OPEN',
    merged: false,
    mergedAt: null,
    closedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
    author: { __typename: 'User', login: 'ana' },
    headRefName: 'oppenheimer/keychain',
    headRefOid: 'abc',
    baseRefName: 'main',
    isCrossRepository: false,
    headRepository: { id: 'R_1' },
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'BLOCKED',
    reviewRequests: {
      nodes: [
        { requestedReviewer: { __typename: 'User', login: 'bruno' } },
        { requestedReviewer: { __typename: 'Team' } },
      ],
    },
    files: { pageInfo: { hasNextPage: false }, nodes: [{ path: 'src/auth/keychain.ts' }] },
    reviews: {
      pageInfo: { hasNextPage: false },
      nodes: [
        {
          databaseId: 7,
          state: 'APPROVED',
          submittedAt: '2026-10-02T00:00:00Z',
          author: { login: 'bruno' },
        },
      ],
    },
    commits: {
      nodes: [
        {
          commit: {
            statusCheckRollup: {
              contexts: {
                pageInfo: { hasNextPage: false },
                nodes: [
                  { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
                  { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: null },
                  { __typename: 'StatusContext', state: 'SUCCESS' },
                ],
              },
            },
          },
        },
      ],
    },
    ...overrides,
  };
}

const answer = (nodes: unknown[], errors?: unknown[]) =>
  ({
    data: {
      repository: { pullRequests: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
    },
    ...(errors ? { errors } : {}),
  }) as OpenPullsBody;

describe('one page of open pull requests', () => {
  it('reads a pull request in the shape the REST read gave it', () => {
    const [read] = openPullRequestsOf(answer([node()])).pulls;

    expect(read?.pull).toMatchObject({
      number: 12,
      authorLogin: 'ana',
      authorIsBot: false,
      state: 'open',
      headSha: 'abc',
      nodeId: 'PR_kwDO',
      mergeable: true,
      mergeableState: 'blocked',
      fromFork: false,
      requestedReviewers: ['bruno'],
    });
    expect(read?.files).toEqual({ value: ['src/auth/keychain.ts'], refusal: null });
    expect(read?.reviews.value).toEqual([
      { id: 7, login: 'bruno', state: 'APPROVED', submittedAt: '2026-10-02T00:00:00Z' },
    ]);
  });

  it('counts check runs and commit statuses together, a running one keeping the head running', () => {
    const [read] = openPullRequestsOf(answer([node()])).pulls;

    expect(read?.checks.value).toEqual({
      state: 'running',
      total: 3,
      passed: 2,
      failed: 0,
      pending: 1,
    });
  });

  it('reads a head with no checks as none, not as failing', () => {
    const [read] = openPullRequestsOf(
      answer([node({ commits: { nodes: [{ commit: { statusCheckRollup: null } }] } })]),
    ).pulls;

    expect(read?.checks.value?.state).toBe('none');
  });

  // GraphQL names a bot `dependabot`; REST, and so the rest of the module, `dependabot[bot]`.
  it('names a bot the way REST does', () => {
    const [read] = openPullRequestsOf(
      answer([node({ author: { __typename: 'Bot', login: 'dependabot' } })]),
    ).pulls;

    expect(read?.pull.authorLogin).toBe('dependabot[bot]');
    expect(read?.pull.authorIsBot).toBe(true);
  });

  it('reads a conflict as not mergeable and a deleted fork as a fork', () => {
    const [read] = openPullRequestsOf(
      answer([node({ mergeable: 'CONFLICTING', headRepository: null })]),
    ).pulls;

    expect(read?.pull.mergeable).toBe(false);
    expect(read?.pull.fromFork).toBe(true);
  });

  // A list cut at the page is never shown as all of it (#244).
  it('says a part ran past its page instead of answering the first hundred as all of it', () => {
    const [read] = openPullRequestsOf(
      answer([node({ files: { pageInfo: { hasNextPage: true }, nodes: [{ path: 'a.ts' }] } })]),
    ).pulls;

    expect(read?.files).toEqual({ value: null, refusal: null, overflow: true });
  });

  // An installation without Checks: read gets the pull request and an error naming its checks.
  it('costs a refused part that part, on that pull request only', () => {
    const { pulls } = openPullRequestsOf(
      answer(
        [node({ commits: null }), node({ number: 13 })],
        [
          {
            type: 'FORBIDDEN',
            message: 'Resource not accessible by integration',
            path: ['repository', 'pullRequests', 'nodes', 0, 'commits'],
          },
        ],
      ),
    );

    expect(pulls[0]?.checks).toEqual({ value: null, refusal: 'forbidden' });
    expect(pulls[1]?.checks.refusal).toBeNull();
  });

  it('gives the cursor to the next page while GitHub has one', () => {
    const body = answer([node()]);
    if (body.data?.repository)
      body.data.repository.pullRequests.pageInfo = { hasNextPage: true, endCursor: 'Y3Vy' };

    expect(openPullRequestsOf(body).next).toBe('Y3Vy');
  });
});

describe('a read that answers no repository', () => {
  it('is a missing repository when GitHub cannot find it', () => {
    expect(() =>
      openPullRequestsOf({
        data: { repository: null },
        errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a Repository' }],
      }),
    ).toThrow(expect.objectContaining({ code: 'GITHUB_013' }));
  });

  it('is a rate limit when GitHub says so, never GitHub failing', () => {
    expect(() =>
      openPullRequestsOf({
        errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
      }),
    ).toThrow(expect.objectContaining({ code: 'GITHUB_015' }));
  });
});
