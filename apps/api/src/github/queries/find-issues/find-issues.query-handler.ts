import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type {
  PullRequestAccessPort,
  WorkspaceRepository,
} from '../../application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../github.di-tokens';
import type { GithubIssue } from '../../infrastructure/github-pulls.port';
import { FindIssuesQuery } from './find-issues.query';

/** One repository's issues, read live through the installation: never mirrored. */
@QueryHandler(FindIssuesQuery)
export class FindIssuesQueryHandler
  implements
    IQueryHandler<FindIssuesQuery, { repository: WorkspaceRepository; issues: GithubIssue[] }>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  execute({ scope, repository, filter, limit }: FindIssuesQuery) {
    return this.access.issues(scope, repository, filter, limit);
  }
}
