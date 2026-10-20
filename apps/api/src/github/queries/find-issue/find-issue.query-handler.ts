import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type {
  PullRequestAccessPort,
  WorkspaceRepository,
} from '../../application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../github.di-tokens';
import type { GithubIssue } from '../../infrastructure/github-pulls.port';
import { FindIssueQuery } from './find-issue.query';

/** One issue, read live; a number that is a pull request is `GITHUB_016`. */
@QueryHandler(FindIssueQuery)
export class FindIssueQueryHandler
  implements IQueryHandler<FindIssueQuery, { repository: WorkspaceRepository; issue: GithubIssue }>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  execute({ scope, address }: FindIssueQuery) {
    return this.access.issue(scope, address);
  }
}
