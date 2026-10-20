import { Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import { GithubHttp, type StatusMap } from './github-http.adapter';
import type {
  GithubIssue,
  GithubIssueComment,
  GithubIssueFilter,
  GithubIssueInput,
  GithubIssuesPort,
} from './github-issues.port';
import type { GithubCredential } from './github-pulls.port';

/**
 * How many pages of a hundred an issue listing reads at most. GitHub mixes
 * pull requests into its issues, so a repository busy with pull requests
 * needs more than one page for a few issues; ten bounds one call at ten
 * requests of the installation's 5,000 an hour.
 */
const ISSUE_PAGES = 10;

/** An issue's comments, a hundred a page. */
const COMMENT_PAGES = 30;

interface RawUser {
  login: string;
}

interface RawIssue {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  state_reason?: string | null;
  user: RawUser | null;
  body?: string | null;
  labels?: (string | { name?: string })[];
  assignees?: RawUser[] | null;
  comments?: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  /** Present when the issue is a pull request. */
  pull_request?: unknown;
}

interface RawIssueComment {
  id: number;
  user: RawUser | null;
  body?: string;
  created_at: string;
}

/** What an issue route's refusals mean here: no such issue, or no access to the repository's issues. */
const ISSUE_STATUS: StatusMap = {
  403: GithubErrors.ISSUES_FORBIDDEN,
  404: GithubErrors.ISSUE_NOT_FOUND,
  410: GithubErrors.ISSUE_NOT_FOUND,
};

/**
 * GitHub's issue endpoints on the platform `fetch`, through {@link GithubHttp}
 * like the pull request adapter beside it, counted against the budget the
 * caller names on the credential: the installation's token to read, the
 * person's own to open and comment, so GitHub records that person. Issues
 * need the App's Issues permission; without it GitHub answers `403`, which
 * is `GITHUB_017`.
 *
 * **Nothing here logs a token or a response body.**
 */
@Injectable()
export class GithubIssuesAdapter implements GithubIssuesPort {
  constructor(private readonly http: GithubHttp) {}

  async listIssues(
    credential: GithubCredential,
    fullName: string,
    filter: GithubIssueFilter,
    limit: number,
  ): Promise<GithubIssue[]> {
    const query = new URLSearchParams({ state: filter.state, sort: 'updated', direction: 'desc' });
    if (filter.labels.length) query.set('labels', filter.labels.join(','));
    if (filter.assignee) query.set('assignee', filter.assignee);
    if (filter.creator) query.set('creator', filter.creator);
    const issues = await this.http.paginate<RawIssue>(
      `${this.repo(fullName)}/issues?${query.toString()}`,
      {
        bucket: credential.bucket,
        token: credential.token,
        onStatus: ISSUE_STATUS,
        unauthorized: GithubErrors.USER_NOT_CONNECTED,
      },
      (body) =>
        Array.isArray(body)
          ? (body as RawIssue[]).filter((issue) => issue.pull_request === undefined)
          : [],
      ISSUE_PAGES,
      limit,
    );
    return issues.slice(0, limit).map(toIssue);
  }

  async readIssue(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubIssue> {
    const { body } = await this.request<RawIssue>(`${this.repo(fullName)}/issues/${number}`, {
      credential,
      onStatus: ISSUE_STATUS,
    });
    if (body.pull_request !== undefined) {
      throw new AppError(GithubErrors.ISSUE_NOT_FOUND, {
        detail: `#${number} in ${fullName} is a pull request, not an issue`,
      });
    }
    return toIssue(body);
  }

  async listIssueComments(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubIssueComment[]> {
    const raw = await this.paginate<RawIssueComment>(
      `${this.repo(fullName)}/issues/${number}/comments`,
      credential,
      COMMENT_PAGES,
    );
    return raw.map((comment) => ({
      id: comment.id,
      login: comment.user?.login ?? 'ghost',
      body: comment.body ?? '',
      createdAt: comment.created_at,
    }));
  }

  async createIssue(
    credential: GithubCredential,
    fullName: string,
    issue: GithubIssueInput,
  ): Promise<GithubIssue> {
    const { body } = await this.request<RawIssue>(`${this.repo(fullName)}/issues`, {
      credential,
      method: 'POST',
      body: {
        title: issue.title,
        ...(issue.body ? { body: issue.body } : {}),
        ...(issue.labels.length ? { labels: issue.labels } : {}),
        ...(issue.assignees.length ? { assignees: issue.assignees } : {}),
      },
      onStatus: ISSUE_STATUS,
    });
    return toIssue(body);
  }

  async createIssueComment(
    credential: GithubCredential,
    fullName: string,
    number: number,
    body: string,
  ): Promise<{ htmlUrl: string }> {
    const { body: created } = await this.request<{ html_url?: string }>(
      `${this.repo(fullName)}/issues/${number}/comments`,
      { credential, method: 'POST', body: { body }, onStatus: ISSUE_STATUS },
    );
    return { htmlUrl: created.html_url ?? '' };
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
        onStatus: ISSUE_STATUS,
        unauthorized: GithubErrors.USER_NOT_CONNECTED,
      },
      (body) => (Array.isArray(body) ? (body as T[]) : []),
      maxPages,
    );
  }

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

function toIssue(issue: RawIssue): GithubIssue {
  return {
    number: issue.number,
    title: issue.title,
    htmlUrl: issue.html_url,
    state: issue.state,
    stateReason: issue.state_reason ?? null,
    authorLogin: issue.user?.login ?? 'ghost',
    body: issue.body ?? '',
    labels: (issue.labels ?? [])
      .map((label) => (typeof label === 'string' ? label : (label.name ?? '')))
      .filter(Boolean),
    assignees: (issue.assignees ?? []).map((user) => user.login),
    comments: issue.comments ?? 0,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
  };
}
