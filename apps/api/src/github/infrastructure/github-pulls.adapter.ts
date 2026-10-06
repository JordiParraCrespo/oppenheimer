import { Injectable } from '@nestjs/common';
import { GithubErrors } from '../domain/github.errors';
import { GithubHttp, type StatusMap } from './github-http.adapter';
import type {
  GithubChecks,
  GithubCredential,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestReview,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubReviewComment,
  GithubReviewInput,
} from './github-pulls.port';

/** A pull request's files, reviews and comments: GitHub stops listing files at 3,000 anyway. */
const MAX_PAGES = 30;

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
 * person did. Every call goes through {@link GithubHttp}, the one client this
 * module has, counted against the budget the caller names on the credential.
 *
 * **Nothing here logs a token or a response body.**
 */
@Injectable()
export class GithubPullsAdapter implements GithubPullsPort {
  constructor(private readonly http: GithubHttp) {}

  async listPullRequests(
    credential: GithubCredential,
    fullName: string,
    state: 'open' | 'closed',
    maxPages: number,
  ): Promise<GithubPullRequestSummary[]> {
    const raw = await this.paginate<RawPull>(
      `${this.repo(fullName)}/pulls?state=${state}&sort=updated&direction=desc`,
      credential,
      maxPages,
    );
    return raw.map(toSummary);
  }

  async readPullRequest(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestDetail> {
    const { body } = await this.request<RawPull>(`${this.repo(fullName)}/pulls/${number}`, {
      credential,
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
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestFile[]> {
    const raw = await this.paginate<RawFile>(
      `${this.repo(fullName)}/pulls/${number}/files`,
      credential,
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
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestReview[]> {
    const raw = await this.paginate<RawReview>(
      `${this.repo(fullName)}/pulls/${number}/reviews`,
      credential,
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
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubReviewComment[]> {
    const raw = await this.paginate<RawComment>(
      `${this.repo(fullName)}/pulls/${number}/comments`,
      credential,
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
  async readChecks(
    credential: GithubCredential,
    fullName: string,
    sha: string,
  ): Promise<GithubChecks> {
    const [{ body: runs }, { body: combined }] = await Promise.all([
      this.request<{ check_runs?: RawCheckRun[] }>(
        `${this.repo(fullName)}/commits/${sha}/check-runs?per_page=100`,
        {
          credential,
        },
      ),
      this.request<RawCombinedStatus>(`${this.repo(fullName)}/commits/${sha}/status`, {
        credential,
      }),
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
    credential: GithubCredential,
    fullName: string,
    number: number,
    review: GithubReviewInput,
  ): Promise<void> {
    await this.request(`${this.repo(fullName)}/pulls/${number}/reviews`, {
      credential,
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
    credential: GithubCredential,
    fullName: string,
    number: number,
    comment: { commitId: string; path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void> {
    await this.request(`${this.repo(fullName)}/pulls/${number}/comments`, {
      credential,
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
    credential: GithubCredential,
    fullName: string,
    number: number,
    method: 'squash' | 'merge' | 'rebase',
    sha: string,
  ): Promise<void> {
    await this.request(`${this.repo(fullName)}/pulls/${number}/merge`, {
      credential,
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
    return `${this.http.api}/repos/${encodeURIComponent(owner ?? '')}/${encodeURIComponent(name ?? '')}`;
  }

  private paginate<T>(url: string, credential: GithubCredential, maxPages: number): Promise<T[]> {
    return this.http.paginate<T>(
      url,
      {
        bucket: credential.bucket,
        token: credential.token,
        onStatus: { 404: GithubErrors.PULL_REQUEST_NOT_FOUND },
        unauthorized: GithubErrors.USER_NOT_CONNECTED,
      },
      (body) => (Array.isArray(body) ? (body as T[]) : []),
      maxPages,
    );
  }

  /** A `401` here is the person's grant (or the installation token) GitHub no longer accepts. */
  private request<T>(
    url: string,
    options: {
      credential: GithubCredential;
      method?: string;
      body?: unknown;
      onStatus?: StatusMap;
    },
  ): Promise<{ body: T; link: string | null }> {
    return this.http.request<T>(url, {
      bucket: options.credential.bucket,
      token: options.credential.token,
      method: options.method,
      body: options.body,
      onStatus: options.onStatus,
      unauthorized: GithubErrors.USER_NOT_CONNECTED,
    });
  }
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
