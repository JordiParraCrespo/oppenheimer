import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IssueAccessPort } from '../../application/issue-access.port';
import { ISSUE_ACCESS } from '../../github.di-tokens';
import type { GithubIssueComment } from '../../infrastructure/github-issues.port';
import { FindIssueCommentsQuery } from './find-issue-comments.query';

/** An issue's conversation comments, oldest first. */
@QueryHandler(FindIssueCommentsQuery)
export class FindIssueCommentsQueryHandler
  implements IQueryHandler<FindIssueCommentsQuery, GithubIssueComment[]>
{
  constructor(
    @Inject(ISSUE_ACCESS)
    private readonly access: IssueAccessPort,
  ) {}

  execute({ scope, address }: FindIssueCommentsQuery): Promise<GithubIssueComment[]> {
    return this.access.issueComments(scope, address);
  }
}
