import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestReadPort } from '../../../github/application/pull-request-read.port';
import { PULL_REQUEST_READS } from '../../../github/github.di-tokens';
import type { PullRequestFileDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestFilesQuery } from './find-pull-request-files.query';

/** A pull request's files with their unified diffs, as GitHub hands them over. */
@QueryHandler(FindPullRequestFilesQuery)
export class FindPullRequestFilesQueryHandler
  implements IQueryHandler<FindPullRequestFilesQuery, PullRequestFileDto[]>
{
  constructor(
    @Inject(PULL_REQUEST_READS)
    private readonly reads: PullRequestReadPort,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({ scope, address }: FindPullRequestFilesQuery): Promise<PullRequestFileDto[]> {
    const files = await this.reads.files(scope, address);
    return files.map((file) => this.mapper.toFile(file));
  }
}
