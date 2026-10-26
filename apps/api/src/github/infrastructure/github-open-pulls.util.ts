import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import type {
  GithubChecks,
  GithubOpenPullRequest,
  GithubPart,
  GithubPullRequestReview,
  GithubRefusal,
} from './github-pulls.port';

/** A page of open pull requests: fifty keeps one answer well inside GitHub's ten seconds. */
export const OPEN_PULLS_PAGE = 50;
/** Two pages, the hundred newest, which is what the REST listing's one page gave. */
export const OPEN_PULLS_PAGES = 2;

/**
 * The queue's whole read of one repository. Each connection asks one page;
 * a pull request with more files, reviews or checks than that says so
 * (`hasNextPage`) and is read the long way instead.
 *
 * Cost: GitHub prices a query by the connections it asks for, so this is
 * about three of the installation's 5,000 GraphQL points an hour, against
 * one REST request for the listing and four per pull request before.
 */
export const OPEN_PULLS_QUERY = `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: ${OPEN_PULLS_PAGE}, after: $after, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id number title url body isDraft state merged mergedAt closedAt createdAt updatedAt
        author { __typename login }
        headRefName headRefOid baseRefName isCrossRepository
        headRepository { id }
        additions deletions changedFiles mergeable mergeStateStatus
        reviewRequests(first: 50) { nodes { requestedReviewer { __typename ... on User { login } } } }
        files(first: 100) { pageInfo { hasNextPage } nodes { path } }
        reviews(first: 100) { pageInfo { hasNextPage } nodes { databaseId state submittedAt author { login } } }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                contexts(first: 100) {
                  pageInfo { hasNextPage }
                  nodes {
                    __typename
                    ... on CheckRun { status conclusion }
                    ... on StatusContext { state }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

interface Page<T> {
  pageInfo?: { hasNextPage?: boolean };
  nodes?: (T | null)[] | null;
}

interface RawGraphPull {
  id: string;
  number: number;
  title: string;
  url: string;
  body: string | null;
  isDraft: boolean;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  merged: boolean;
  mergedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { __typename?: string; login: string } | null;
  headRefName: string;
  headRefOid: string;
  baseRefName: string;
  isCrossRepository: boolean;
  headRepository: { id: string } | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  mergeStateStatus: string;
  reviewRequests: Page<{
    requestedReviewer: { __typename?: string; login?: string } | null;
  }> | null;
  files: Page<{ path: string }> | null;
  reviews: Page<{
    databaseId: number | null;
    state: GithubPullRequestReview['state'];
    submittedAt: string | null;
    author: { login: string } | null;
  }> | null;
  commits: Page<{
    commit: {
      statusCheckRollup: {
        contexts: Page<{
          __typename?: string;
          status?: string;
          conclusion?: string | null;
          state?: string;
        }>;
      } | null;
    };
  }> | null;
}

export interface GraphError {
  type?: string;
  message?: string;
  path?: (string | number)[];
}

export interface OpenPullsBody {
  data?: {
    repository: {
      pullRequests: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: (RawGraphPull | null)[];
      };
    } | null;
  } | null;
  errors?: GraphError[];
}

/**
 * One page of the answer in this module's vocabulary, and the cursor to the
 * next one. GraphQL answers `200` with an `errors` list either way: an error
 * that names a part of one pull request (`…nodes.3.files`) costs that part,
 * and one that leaves no repository costs the read, as the REST listing's
 * refusal did.
 */
export function openPullRequestsOf(body: OpenPullsBody): {
  pulls: GithubOpenPullRequest[];
  next: string | null;
} {
  const errors = body.errors ?? [];
  const connection = body.data?.repository?.pullRequests;
  if (!connection) throw refusedRead(errors);
  const refusals = partRefusals(errors);
  const pulls = connection.nodes.flatMap((raw, index) =>
    raw ? [openPullRequestOf(raw, refusals.get(index) ?? new Map())] : [],
  );
  return {
    pulls,
    next: connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null,
  };
}

type PartName = 'files' | 'reviews' | 'commits';

/** Which part of which pull request each error names, and GitHub's refusal for it. */
function partRefusals(errors: GraphError[]): Map<number, Map<PartName, GithubRefusal>> {
  const byPull = new Map<number, Map<PartName, GithubRefusal>>();
  for (const error of errors) {
    const [, , , index, part] = error.path ?? [];
    if (typeof index !== 'number') continue;
    if (part !== 'files' && part !== 'reviews' && part !== 'commits') continue;
    const parts = byPull.get(index) ?? new Map<PartName, GithubRefusal>();
    parts.set(part, refusalOfType(error.type));
    byPull.set(index, parts);
  }
  return byPull;
}

function openPullRequestOf(
  raw: RawGraphPull,
  refused: Map<PartName, GithubRefusal>,
): GithubOpenPullRequest {
  return {
    pull: {
      number: raw.number,
      title: raw.title,
      htmlUrl: raw.url,
      authorLogin: loginOf(raw.author),
      authorIsBot: raw.author?.__typename === 'Bot',
      draft: raw.isDraft,
      state: raw.state === 'OPEN' ? 'open' : 'closed',
      merged: raw.merged,
      headRef: raw.headRefName,
      headSha: raw.headRefOid,
      baseRef: raw.baseRefName,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      closedAt: raw.closedAt,
      mergedAt: raw.mergedAt,
      // Teams are left out, as the REST listing's `requested_reviewers` leaves them.
      requestedReviewers: (raw.reviewRequests?.nodes ?? []).flatMap((request) =>
        request?.requestedReviewer?.__typename === 'User' && request.requestedReviewer.login
          ? [request.requestedReviewer.login]
          : [],
      ),
      nodeId: raw.id,
      body: raw.body ?? '',
      additions: raw.additions,
      deletions: raw.deletions,
      changedFiles: raw.changedFiles,
      mergeable:
        raw.mergeable === 'MERGEABLE' ? true : raw.mergeable === 'CONFLICTING' ? false : null,
      // GitHub's REST `mergeable_state` is this enum in lower case.
      mergeableState: raw.mergeStateStatus.toLowerCase(),
      // A head whose repository is gone (a deleted fork) is a fork's too.
      fromFork: raw.isCrossRepository || raw.headRepository === null,
    },
    files: partOf(refused.get('files'), raw.files, (nodes) => nodes.map((file) => file.path)),
    reviews: partOf(refused.get('reviews'), raw.reviews, (nodes) =>
      nodes.map((review) => ({
        id: review.databaseId ?? 0,
        login: review.author?.login ?? 'ghost',
        state: review.state,
        submittedAt: review.submittedAt,
      })),
    ),
    checks: checksOf(refused.get('commits'), raw.commits),
  };
}

function partOf<TNode, T>(
  refusal: GithubRefusal | undefined,
  page: Page<TNode> | null,
  map: (nodes: TNode[]) => T,
): GithubPart<T> {
  if (refusal) return { value: null, refusal };
  if (!page) return { value: null, refusal: 'failed' };
  if (page.pageInfo?.hasNextPage) return { value: null, refusal: null, overflow: true };
  return { value: map(present(page.nodes)), refusal: null };
}

/**
 * Check runs and the older commit statuses together, as the REST read
 * counted them: a repository may use either, and the rollup lists both.
 */
function checksOf(
  refusal: GithubRefusal | undefined,
  commits: RawGraphPull['commits'],
): GithubPart<GithubChecks> {
  if (refusal) return { value: null, refusal };
  if (!commits) return { value: null, refusal: 'failed' };
  const contexts = present(commits.nodes)[0]?.commit.statusCheckRollup?.contexts;
  if (contexts?.pageInfo?.hasNextPage) return { value: null, refusal: null, overflow: true };
  const outcomes = present(contexts?.nodes).map((context) => {
    if (context.__typename === 'CheckRun') {
      if (context.status !== 'COMPLETED') return 'pending';
      return ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(context.conclusion ?? '')
        ? 'passed'
        : 'failed';
    }
    if (context.state === 'SUCCESS') return 'passed';
    return context.state === 'PENDING' || context.state === 'EXPECTED' ? 'pending' : 'failed';
  });
  const count = (outcome: string) => outcomes.filter((o) => o === outcome).length;
  const failed = count('failed');
  const pending = count('pending');
  return {
    value: {
      state:
        outcomes.length === 0
          ? 'none'
          : failed > 0
            ? 'failing'
            : pending > 0
              ? 'running'
              : 'passing',
      total: outcomes.length,
      passed: count('passed'),
      failed,
      pending,
    },
    refusal: null,
  };
}

/** GraphQL names a bot without the `[bot]` REST gives it; the rest of the module reads REST's. */
function loginOf(author: RawGraphPull['author']): string {
  if (!author) return 'ghost';
  return author.__typename === 'Bot' ? `${author.login}[bot]` : author.login;
}

function present<T>(nodes: (T | null)[] | null | undefined): T[] {
  return (nodes ?? []).filter((node): node is T => node !== null);
}

function refusalOfType(type: string | undefined): GithubRefusal {
  if (type === 'FORBIDDEN') return 'forbidden';
  if (type === 'NOT_FOUND') return 'not_found';
  if (type === 'RATE_LIMITED') return 'rate_limited';
  return 'failed';
}

/** A read that came back with no repository, in the codes the REST listing's refusals had. */
function refusedRead(errors: GraphError[]): AppError {
  const detail =
    errors.map((error) => error.message ?? error.type ?? 'unknown').join('; ') ||
    'GitHub answered with no repository.';
  const types = errors.map((error) => error.type);
  if (types.includes('RATE_LIMITED')) return new AppError(GithubErrors.RATE_LIMITED, { detail });
  if (types.includes('NOT_FOUND')) {
    return new AppError(GithubErrors.PULL_REQUEST_NOT_FOUND, {
      detail,
      extensions: { upstreamStatus: 404 },
    });
  }
  return new AppError(GithubErrors.UPSTREAM_FAILED, {
    detail,
    extensions: { upstreamStatus: types.includes('FORBIDDEN') ? 403 : 200 },
  });
}
