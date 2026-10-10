import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import type { PullRequestDetailResponseDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestQuery } from './find-pull-request.query';

/** One pull request's briefing: GitHub's detail, its lane, what holds it and the path to merge. */
@QueryHandler(FindPullRequestQuery)
export class FindPullRequestQueryHandler
  implements IQueryHandler<FindPullRequestQuery, PullRequestDetailResponseDto>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({ scope, address }: FindPullRequestQuery): Promise<PullRequestDetailResponseDto> {
    const [snapshot, viewerLogin] = await Promise.all([
      this.access.pullRequest(scope, address),
      this.access.viewerLogin(scope),
    ]);
    return this.mapper.toDetail(snapshot, viewerLogin, new Date());
  }
}
