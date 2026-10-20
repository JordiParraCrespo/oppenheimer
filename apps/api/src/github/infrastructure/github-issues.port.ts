import type { GithubCredential } from './github-pulls.port';

/**
 * GitHub's issue endpoints, in this module's vocabulary, called with a token
 * the caller supplies: an installation token to read, the person's own user
 * token to act. Nothing of GitHub's wire shape crosses this line.
 */

export interface GithubIssue {
  number: number;
  title: string;
  htmlUrl: string;
  state: 'open' | 'closed';
  /** GitHub's `state_reason` once closed: `completed`, `not_planned`, `duplicate`. */
  stateReason: string | null;
  authorLogin: string;
  body: string;
  labels: string[];
  assignees: string[];
  comments: number;
  /** ISO 8601. */
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface GithubIssueComment {
  id: number;
  login: string;
  body: string;
  createdAt: string;
}

export interface GithubIssueFilter {
  state: 'open' | 'closed' | 'all';
  /** Logins and label names exactly as GitHub knows them. */
  labels: string[];
  assignee: string | null;
  creator: string | null;
}

export interface GithubIssueInput {
  title: string;
  body?: string;
  labels: string[];
  assignees: string[];
}

export interface GithubIssuesPort {
  /**
   * Newest updated first, at most `limit`, pull requests left out (GitHub
   * lists them among the issues, so it reads on until `limit` issues or its
   * page cap).
   */
  listIssues(
    credential: GithubCredential,
    fullName: string,
    filter: GithubIssueFilter,
    limit: number,
  ): Promise<GithubIssue[]>;
  /** A number that is a pull request is `GITHUB_016`, as one that does not exist. */
  readIssue(credential: GithubCredential, fullName: string, number: number): Promise<GithubIssue>;
  /** Its conversation comments, oldest first. */
  listIssueComments(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubIssueComment[]>;
  createIssue(
    credential: GithubCredential,
    fullName: string,
    issue: GithubIssueInput,
  ): Promise<GithubIssue>;
  /**
   * A comment on an issue's conversation, or a pull request's: GitHub numbers
   * both alike. Answers the comment's link.
   */
  createIssueComment(
    credential: GithubCredential,
    fullName: string,
    number: number,
    body: string,
  ): Promise<{ htmlUrl: string }>;
}
