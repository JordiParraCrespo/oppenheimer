import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestReadPort } from '../../../github/application/pull-request-read.port';
import { PULL_REQUEST_READS } from '../../../github/github.di-tokens';
import { PullRequestBriefResolver } from '../../application/pull-request-brief.resolver';
import { briefFromDescription } from '../../domain/pull-request-brief.policy';
import type { PullRequestBriefResponseDto } from '../../dtos/pull-request-brief.response.dto';
import { PullRequestBriefMapper } from '../../pull-request-brief.mapper';
import { FindPullRequestBriefQuery } from './find-pull-request-brief.query';

/**
 * A pull request's brief for its head commit: the model's when there is one,
 * else what its own description says. The pull request is read first, so a
 * caller who cannot see it is refused before anything is looked up.
 */
@QueryHandler(FindPullRequestBriefQuery)
export class FindPullRequestBriefQueryHandler
  implements IQueryHandler<FindPullRequestBriefQuery, PullRequestBriefResponseDto>
{
  constructor(
    @Inject(PULL_REQUEST_READS)
    private readonly reads: PullRequestReadPort,
    private readonly briefs: PullRequestBriefResolver,
    private readonly mapper: PullRequestBriefMapper,
  ) {}

  async execute({
    scope,
    address,
  }: FindPullRequestBriefQuery): Promise<PullRequestBriefResponseDto> {
    const { pull } = await this.reads.pullRequest(scope, address);
    const written = await this.briefs.modelBrief(scope, address, pull);
    return written
      ? this.mapper.toResponse(pull, written, 'model')
      : this.mapper.toResponse(pull, briefFromDescription(pull.title, pull.body), 'description');
  }
}
