import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WatchedRepositoriesResolver } from '../../application/watched-repositories.resolver';
import type { WatchedRepositoryDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindWatchedRepositoriesQuery } from './find-watched-repositories.query';

/** Manage repositories: every repository the installations cover, and whether the caller watches it. */
@QueryHandler(FindWatchedRepositoriesQuery)
export class FindWatchedRepositoriesQueryHandler
  implements IQueryHandler<FindWatchedRepositoriesQuery, WatchedRepositoryDto[]>
{
  constructor(
    private readonly watched: WatchedRepositoriesResolver,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({ scope }: FindWatchedRepositoriesQuery): Promise<WatchedRepositoryDto[]> {
    const entries = await this.watched.all(scope);
    return entries
      .map((entry) => this.mapper.toWatch(entry.repository, entry.watching))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}
