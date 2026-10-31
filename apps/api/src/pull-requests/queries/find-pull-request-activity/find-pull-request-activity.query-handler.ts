import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestReadPort } from '../../../github/application/pull-request-read.port';
import { PULL_REQUEST_READS } from '../../../github/github.di-tokens';
import type { PullRequestActivityItemDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestActivityQuery } from './find-pull-request-activity.query';

/** A pull request's conversation: its comments, commits, reviews and events, oldest first. */
@QueryHandler(FindPullRequestActivityQuery)
export class FindPullRequestActivityQueryHandler
  implements IQueryHandler<FindPullRequestActivityQuery, PullRequestActivityItemDto[]>
{
  constructor(
    @Inject(PULL_REQUEST_READS)
    private readonly reads: PullRequestReadPort,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({
    scope,
    address,
  }: FindPullRequestActivityQuery): Promise<PullRequestActivityItemDto[]> {
    const items = await this.reads.activity(scope, address);
    return items.map((item) => this.mapper.toActivity(item));
  }
}
