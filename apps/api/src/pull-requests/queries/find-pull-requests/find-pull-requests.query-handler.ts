import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { WatchedRepositoriesResolver } from '../../application/watched-repositories.resolver';
import { visibleInQueue } from '../../domain/pull-request-merge.policy';
import type { PullRequestQueueResponseDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestsQuery } from './find-pull-requests.query';

/**
 * The queue: the open pull requests the installations reach, each sorted into
 * whose it is and which lane it needs. Yours and the ones asking for your
 * review come from every repository; the rest only from the repositories you
 * watch, which start as none. All three scopes are counted from the one read,
 * so the scope control's numbers and the list never disagree.
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
    // Nothing watched is where every workspace starts, and it is answered from
    // our own rows: a queue drawn before the reader has picked a repository
    // asks GitHub for nothing at all (#247).
    if (!(await this.watched.anyWatched(scope))) {
      return this.mapper.toQueue([], queue, null, []);
    }
    const [repositories, viewerLogin] = await Promise.all([
      this.watched.all(scope),
      this.access.viewerLogin(scope.userId),
    ]);
    // A repository GitHub will not answer costs its own rows, not the queue (#244). Its gap is
    // reported whether or not it is watched: yours and your review requests come from every repository.
    const reads = await Promise.all(
      repositories.map(({ repository }) => this.access.openPullRequests(scope, repository)),
    );
    const now = new Date();
    const rows = reads.flatMap((read, index) =>
      read.snapshots
        .map((snapshot) => this.mapper.toRow(snapshot, viewerLogin, now))
        .filter((row) => visibleInQueue(row.scope, repositories[index]?.watching ?? false)),
    );
    return this.mapper.toQueue(rows, queue, viewerLogin, reads);
  }
}
