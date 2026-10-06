import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '@oppenheimer/backend-core';
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_FETCH } from '../github.di-tokens';
import type {
  GithubChecks,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestReview,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubReviewComment,
  GithubReviewInput,
} from './github-pulls.port';
import {
  GithubPausedError,
  GithubRequestGate,
  readRateLimit,
  withJitter,
} from './github-rate-limit.util';
import type { GithubFetch } from './github-rest.adapter';

const API_VERSION = '2022-11-28';
const USER_AGENT = 'oppenheimer-control-plane';
const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;
/** A pull request's files, reviews and comments: GitHub stops listing files at 3,000 anyway. */
const MAX_PAGES = 30;
/** Times one request waits out a limit before the refusal is the caller's. */
const MAX_LIMIT_RETRIES = 2;

interface RawUser {
  login: string;
  type?: string;
}

interface RawPull {
  number: number;
  title: string;
  html_url: string;
  user: RawUser | null;
  draft?: boolean;
  state: 'open' | 'closed';
  merged_at: string | null;
  merged?: boolean;
  head: { ref: string; sha: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  requested_reviewers?: RawUser[];
  body?: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  mergeable?: boolean | null;
  mergeable_state?: string;
}

interface RawFile {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface RawReview {
  id: number;
  user: RawUser | null;
  state: GithubPullRequestReview['state'];
  submitted_at?: string | null;
}

interface RawComment {
  id: number;
  path: string;
  line?: number | null;
  original_line?: number | null;
  side?: 'LEFT' | 'RIGHT';
  body: string;
  user: RawUser | null;
  created_at: string;
}

interface RawCheckRun {
  status: string;
  conclusion: string | null;
}

interface RawCombinedStatus {
  statuses?: { state: string }[];
}

/**
 * GitHub's pull request endpoints on the platform `fetch`, like the App adapter
 * beside it. The token is the caller's: an installation token to read, the
 * person's own to comment, review and merge, so what GitHub records is what that
 * person did.
 *
 * **Nothing here logs a token or a response body.**
 */
@Injectable()
export class GithubPullsAdapter implements GithubPullsPort {
  private readonly logger = new Logger(GithubPullsAdapter.name);
  private readonly http: GithubFetch;
  /** Every pull request read and write, paced per token (#247). */
  private readonly gate = new GithubRequestGate();

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(GITHUB_FETCH)
    fetchImpl?: GithubFetch,
  ) {
    this.http = fetchImpl ?? globalThis.fetch;
  }

  private get api(): string {
    return (
      this.configService.get<string>('githubApp.apiBaseUrl') ?? 'https://api.github.com'
    ).replace(/\/+$/, '');
  }

  async listPullRequests(
    token: string,
    fullName: string,
    state: 'open' | 'closed',
    maxPages: number,
  ): Promise<GithubPullRequestSummary[]> {
    const raw = await this.paginate<RawPull>(
      `${this.repo(fullName)}/pulls?state=${state}&sort=updated&direction=desc`,
      token,
      maxPages,
    );
    return raw.map(toSummary);
  }

  async readPullRequest(
    token: string,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestDetail> {
    const { body } = await this.request<RawPull>(`${this.repo(fullName)}/pulls/${number}`, {
      token,
      onStatus: { 404: GithubErrors.PULL_REQUEST_NOT_FOUND },
    });
    return {
      ...toSummary(body),
      body: body.body ?? '',
      additions: body.additions ?? 0,
      deletions: body.deletions ?? 0,
      changedFiles: body.changed_files ?? 0,
      mergeable: body.mergeable ?? null,
      mergeableState: body.mergeable_state ?? 'unknown',
    };
  }

  async listFiles(
    token: string,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestFile[]> {
    const raw = await this.paginate<RawFile>(
      `${this.repo(fullName)}/pulls/${number}/files`,
      token,
      MAX_PAGES,
    );
    return raw.map((file) => ({
      path: file.filename,
      previousPath: file.previous_filename ?? null,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch ?? null,
    }));
  }

  async listReviews(
    token: string,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestReview[]> {
    const raw = await this.paginate<RawReview>(
      `${this.repo(fullName)}/pulls/${number}/reviews`,
      token,
      MAX_PAGES,
    );
    return raw.map((review) => ({
      id: review.id,
      login: review.user?.login ?? 'ghost',
      state: review.state,
      submittedAt: review.submitted_at ?? null,
    }));
  }

  async listReviewComments(
    token: string,
    fullName: string,
    number: number,
  ): Promise<GithubReviewComment[]> {
    const raw = await this.paginate<RawComment>(
      `${this.repo(fullName)}/pulls/${number}/comments`,
      token,
      MAX_PAGES,
    );
    return raw.map((comment) => ({
      id: comment.id,
      path: comment.path,
      line: comment.line ?? comment.original_line ?? null,
      side: comment.side ?? 'RIGHT',
      body: comment.body,
      login: comment.user?.login ?? 'ghost',
      createdAt: comment.created_at,
    }));
  }

  /** Check runs and the older commit statuses together: a repository may use either. */
  async readChecks(token: string, fullName: string, sha: string): Promise<GithubChecks> {
    const [{ body: runs }, { body: combined }] = await Promise.all([
      this.request<{ check_runs?: RawCheckRun[] }>(
        `${this.repo(fullName)}/commits/${sha}/check-runs?per_page=100`,
        {
          token,
        },
      ),
      this.request<RawCombinedStatus>(`${this.repo(fullName)}/commits/${sha}/status`, { token }),
    ]);
    const outcomes: ('passed' | 'failed' | 'pending')[] = [
      ...(runs.check_runs ?? []).map((run) =>
        run.status !== 'completed'
          ? ('pending' as const)
          : ['success', 'neutral', 'skipped'].includes(run.conclusion ?? '')
            ? ('passed' as const)
            : ('failed' as const),
      ),
      ...(combined.statuses ?? []).map((status) =>
        status.state === 'success'
          ? ('passed' as const)
          : status.state === 'pending'
            ? ('pending' as const)
            : ('failed' as const),
      ),
    ];
    const count = (outcome: string) => outcomes.filter((o) => o === outcome).length;
    const failed = count('failed');
    const pending = count('pending');
    return {
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
    };
  }

  async createReview(
    token: string,
    fullName: string,
    number: number,
    review: GithubReviewInput,
  ): Promise<void> {
    await this.request(`${this.repo(fullName)}/pulls/${number}/reviews`, {
      token,
      method: 'POST',
      body: {
        event: review.event,
        commit_id: review.commitId,
        ...(review.body ? { body: review.body } : {}),
        comments: review.comments.map((comment) => ({
          path: comment.path,
          line: comment.line,
          side: comment.side,
          body: comment.body,
        })),
      },
      onStatus: { 404: GithubErrors.PULL_REQUEST_NOT_FOUND },
    });
  }

  async createReviewComment(
    token: string,
    fullName: string,
    number: number,
    comment: { commitId: string; path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void> {
    await this.request(`${this.repo(fullName)}/pulls/${number}/comments`, {
      token,
      method: 'POST',
      body: {
        body: comment.body,
        commit_id: comment.commitId,
        path: comment.path,
        line: comment.line,
        side: comment.side,
      },
      onStatus: { 404: GithubErrors.PULL_REQUEST_NOT_FOUND },
    });
  }

  async merge(
    token: string,
    fullName: string,
    number: number,
    method: 'squash' | 'merge' | 'rebase',
    sha: string,
  ): Promise<void> {
    await this.request(`${this.repo(fullName)}/pulls/${number}/merge`, {
      token,
      method: 'PUT',
      body: { merge_method: method, sha },
      onStatus: {
        404: GithubErrors.PULL_REQUEST_NOT_FOUND,
        405: GithubErrors.MERGE_REFUSED,
        409: GithubErrors.MERGE_REFUSED,
        422: GithubErrors.MERGE_REFUSED,
      },
    });
  }

  private repo(fullName: string): string {
    const [owner, name] = fullName.split('/');
    return `${this.api}/repos/${encodeURIComponent(owner ?? '')}/${encodeURIComponent(name ?? '')}`;
  }

  private async paginate<T>(url: string, token: string, maxPages: number): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = `${url}${url.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}`;
    for (let page = 0; page < maxPages && next; page += 1) {
      const { body, link } = await this.request<unknown>(next, {
        token,
        onStatus: { 404: GithubErrors.PULL_REQUEST_NOT_FOUND },
      });
      if (Array.isArray(body)) items.push(...(body as T[]));
      next = nextPageUrl(link);
    }
    return items;
  }

  private async request<T>(
    url: string,
    options: {
      token: string;
      method?: string;
      body?: unknown;
      onStatus?: Partial<Record<number, ErrorDefinition>>;
    },
  ): Promise<{ body: T; link: string | null }> {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.gate.run(options.token, () => this.send(url, options));
      } catch (error) {
        if (error instanceof GithubPausedError) throw rateLimited(error.resumeAt, null);
        throw error;
      }
      const upstreamMessage = response.ok ? null : ((await messageOf(response)) ?? null);
      const limit = readRateLimit(response.status, response.headers, upstreamMessage);

      if (limit.limited && limit.resumeAt !== null) {
        const now = Date.now();
        // One clock: the gate holds the token until then, sleeping through a short wait and refusing a long one.
        this.gate.pause(options.token, now + withJitter(Math.max(0, limit.resumeAt - now)));
        this.logger.warn({
          message: 'GitHub asked to wait',
          url: pathOf(url),
          status: response.status,
        });
        if (attempt < MAX_LIMIT_RETRIES) continue;
        throw rateLimited(limit.resumeAt, response.status, upstreamMessage);
      }

      if (!response.ok) {
        this.logger.warn({
          message: 'GitHub rejected a request',
          url: pathOf(url),
          status: response.status,
        });
        const named = options.onStatus?.[response.status];
        throw new AppError(
          named ??
            (response.status === 401
              ? GithubErrors.USER_NOT_CONNECTED
              : GithubErrors.UPSTREAM_FAILED),
          {
            detail: upstreamMessage ?? 'GitHub answered this request with an error.',
            extensions: { upstreamStatus: response.status },
          },
        );
      }

      const text = await response.text();
      return { body: (text ? JSON.parse(text) : {}) as T, link: response.headers.get('link') };
    }
  }

  private async send(
    url: string,
    options: { token: string; method?: string; body?: unknown },
  ): Promise<Response> {
    try {
      return await this.http(url, {
        method: options.method ?? 'GET',
        headers: {
          accept: 'application/vnd.github+json',
          'x-github-api-version': API_VERSION,
          'user-agent': USER_AGENT,
          authorization: `Bearer ${options.token}`,
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn({ message: 'GitHub could not be reached', url: pathOf(url) }, String(error));
      throw new AppError(GithubErrors.UPSTREAM_FAILED, {
        detail: 'GitHub could not be reached.',
        extensions: { upstreamStatus: null },
      });
    }
  }
}

/** `GITHUB_015`: GitHub asked this token to wait, and until when. */
function rateLimited(
  resumeAt: number,
  upstreamStatus: number | null,
  message?: string | null,
): AppError {
  return new AppError(GithubErrors.RATE_LIMITED, {
    detail: message ?? 'GitHub asked to wait before the next request.',
    extensions: {
      upstreamStatus,
      retryAfterSeconds: Math.max(1, Math.ceil((resumeAt - Date.now()) / 1000)),
    },
  });
}

function toSummary(pull: RawPull): GithubPullRequestSummary {
  return {
    number: pull.number,
    title: pull.title,
    htmlUrl: pull.html_url,
    authorLogin: pull.user?.login ?? 'ghost',
    authorIsBot: pull.user?.type === 'Bot',
    draft: Boolean(pull.draft),
    state: pull.state,
    merged: Boolean(pull.merged_at) || Boolean(pull.merged),
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    baseRef: pull.base.ref,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    closedAt: pull.closed_at,
    mergedAt: pull.merged_at,
    requestedReviewers: (pull.requested_reviewers ?? []).map((user) => user.login),
  };
}

async function messageOf(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === 'string' ? body.message : undefined;
  } catch {
    return undefined;
  }
}

function nextPageUrl(link: string | null): string | undefined {
  if (!link) return undefined;
  for (const part of link.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part.trim());
    if (match) return match[1];
  }
  return undefined;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
