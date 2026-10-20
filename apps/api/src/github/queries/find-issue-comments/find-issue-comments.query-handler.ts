import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../github.di-tokens';
import type { GithubIssueComment } from '../../infrastructure/github-pulls.port';
import { FindIssueCommentsQuery } from './find-issue-comments.query';

/** An issue's conversation comments, oldest first. */
@QueryHandler(FindIssueCommentsQuery)
export class FindIssueCommentsQueryHandler
  implements IQueryHandler<FindIssueCommentsQuery, GithubIssueComment[]>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  execute({ scope, address }: FindIssueCommentsQuery): Promise<GithubIssueComment[]> {
    return this.access.issueComments(scope, address);
  }
}
