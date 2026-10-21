import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IssueAccessPort } from '../../application/issue-access.port';
import type { WorkspaceRepository } from '../../application/pull-request-access.port';
import { ISSUE_ACCESS } from '../../github.di-tokens';
import type { GithubIssue } from '../../infrastructure/github-issues.port';
import { FindIssuesQuery } from './find-issues.query';

/** One repository's issues, read live through the installation: never mirrored. */
@QueryHandler(FindIssuesQuery)
export class FindIssuesQueryHandler
  implements
    IQueryHandler<FindIssuesQuery, { repository: WorkspaceRepository; issues: GithubIssue[] }>
{
  constructor(
    @Inject(ISSUE_ACCESS)
    private readonly access: IssueAccessPort,
  ) {}

  execute({ scope, repository, filter, limit }: FindIssuesQuery) {
    return this.access.issues(scope, repository, filter, limit);
  }
}
