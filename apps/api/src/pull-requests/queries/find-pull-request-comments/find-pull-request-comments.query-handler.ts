import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import type { PullRequestCommentDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestCommentsQuery } from './find-pull-request-comments.query';

/** The comments on a pull request's lines, oldest first. */
@QueryHandler(FindPullRequestCommentsQuery)
export class FindPullRequestCommentsQueryHandler
  implements IQueryHandler<FindPullRequestCommentsQuery, PullRequestCommentDto[]>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({
    scope,
    address,
  }: FindPullRequestCommentsQuery): Promise<PullRequestCommentDto[]> {
    const comments = await this.access.reviewComments(scope, address);
    return comments.map((comment) => this.mapper.toComment(comment));
  }
}
