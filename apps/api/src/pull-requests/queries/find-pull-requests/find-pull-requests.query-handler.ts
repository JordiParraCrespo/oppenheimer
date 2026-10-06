import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { WatchedRepositoriesResolver } from '../../application/watched-repositories.resolver';
import type { PullRequestQueueResponseDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestsQuery } from './find-pull-requests.query';

/**
 * The queue: the open pull requests of every watched repository, read through
 * the installations, each sorted into whose it is and which lane it needs. All
 * three scopes are counted from the one read, so the scope control's numbers
 * and the list never disagree.
 */
@QueryHandler(FindPullRequestsQuery)
export class FindPullRequestsQueryHandler
  implements IQueryHandler<FindPullRequestsQuery, PullRequestQueueResponseDto>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
    private readonly watched: WatchedRepositoriesResolver,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({ scope, queue }: FindPullRequestsQuery): Promise<PullRequestQueueResponseDto> {
    const [repositories, viewerLogin] = await Promise.all([
      this.watched.watched(scope),
      this.access.viewerLogin(scope.userId),
    ]);
    const snapshots = (
      await Promise.all(
        repositories.map((repository) => this.access.openPullRequests(scope, repository)),
      )
    ).flat();
    const now = new Date();
    const rows = snapshots.map((snapshot) => this.mapper.toRow(snapshot, viewerLogin, now));
    return this.mapper.toQueue(rows, queue, viewerLogin);
  }
}
