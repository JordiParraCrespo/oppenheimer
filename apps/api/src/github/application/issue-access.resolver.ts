import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { GITHUB_ISSUES } from '../github.di-tokens';
import type {
  GithubIssue,
  GithubIssueComment,
  GithubIssueFilter,
  GithubIssueInput,
  GithubIssuesPort,
} from '../infrastructure/github-issues.port';
import { GithubAccessResolver } from './github-access.resolver';
import type { IssueAccessPort, IssueAddress } from './issue-access.port';
import type { RepositoryAddress, WorkspaceRepository } from './pull-request-access.port';

/**
 * Issues, read live through the installation and written with the caller's
 * own token; nothing is cached, because nothing reads issues on a poll. The
 * repository and both credentials come from {@link GithubAccessResolver},
 * which the pull request access shares.
 */
@Injectable()
export class IssueAccessResolver implements IssueAccessPort {
  constructor(
    @Inject(GITHUB_ISSUES)
    private readonly github: GithubIssuesPort,
    private readonly access: GithubAccessResolver,
  ) {}

  async issues(
    scope: AccessScope,
    address: RepositoryAddress,
    filter: GithubIssueFilter,
    limit: number,
  ): Promise<{ repository: WorkspaceRepository; issues: GithubIssue[] }> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    const issues = await this.github.listIssues(credential, repository.fullName, filter, limit);
    return { repository, issues };
  }

  async issue(
    scope: AccessScope,
    address: IssueAddress,
  ): Promise<{ repository: WorkspaceRepository; issue: GithubIssue }> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    const issue = await this.github.readIssue(credential, repository.fullName, address.number);
    return { repository, issue };
  }

  async issueComments(scope: AccessScope, address: IssueAddress): Promise<GithubIssueComment[]> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    return this.github.listIssueComments(credential, repository.fullName, address.number);
  }

  async createIssue(
    scope: AccessScope,
    userId: string,
    address: RepositoryAddress,
    issue: GithubIssueInput,
  ): Promise<GithubIssue> {
    const repository = await this.access.repositoryOf(scope, address);
    const writer = await this.access.writeCredential(userId, address);
    return this.github.createIssue(writer, repository.fullName, issue);
  }

  async addComment(
    scope: AccessScope,
    userId: string,
    address: IssueAddress,
    body: string,
  ): Promise<{ htmlUrl: string }> {
    const repository = await this.access.repositoryOf(scope, address);
    const writer = await this.access.writeCredential(userId, address);
    return this.github.createIssueComment(writer, repository.fullName, address.number, body);
  }
}
