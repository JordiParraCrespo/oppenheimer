import type { AccessScope } from '../../authz/domain/access-scope.types';
import type {
  GithubIssue,
  GithubIssueComment,
  GithubIssueFilter,
  GithubIssueInput,
} from '../infrastructure/github-issues.port';
import type {
  InstallationAddress,
  RepositoryAddress,
  WorkspaceRepository,
} from './pull-request-access.port';

/** The address of one issue: GitHub numbers issues and pull requests alike. */
export type IssueAddress = RepositoryAddress & { number: number };

/**
 * The door a workspace's GitHub issues are reached through (`25-bots.md`
 * §4.4). Reads go through the workspace's installations, scoped like every
 * other repository read and never mirrored; writes through the caller's own
 * GitHub user token, so what GitHub records is what that person did. With no
 * user token a write is `GITHUB_012`.
 */
export interface IssueAccessPort {
  /** One repository's issues, newest updated first, at most `limit`; pull requests left out. */
  issues(
    scope: AccessScope,
    repository: RepositoryAddress,
    filter: GithubIssueFilter,
    limit: number,
  ): Promise<{ repository: WorkspaceRepository; issues: GithubIssue[] }>;
  issue(
    scope: AccessScope,
    address: IssueAddress,
  ): Promise<{ repository: WorkspaceRepository; issue: GithubIssue }>;
  issueComments(scope: AccessScope, address: IssueAddress): Promise<GithubIssueComment[]>;
  /** Opens an issue in the caller's own name. */
  createIssue(
    scope: AccessScope,
    userId: string,
    repository: InstallationAddress,
    issue: GithubIssueInput,
  ): Promise<GithubIssue>;
  /** A comment on an issue's or a pull request's conversation, in the caller's own name. */
  addComment(
    scope: AccessScope,
    userId: string,
    address: InstallationAddress & { number: number },
    body: string,
  ): Promise<{ htmlUrl: string }>;
}
