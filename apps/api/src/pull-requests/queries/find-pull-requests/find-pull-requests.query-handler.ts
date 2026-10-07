import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { WatchedRepositoriesResolver } from '../../application/watched-repositories.resolver';
import type { PullRequestQueueResponseDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestsQuery } from './find-pull-requests.query';

/**
 * The queue: the open pull requests of the repositories the reader watches,
 * each sorted into whose it is and which lane it needs. All three scopes are
 * counted from the one read, so the scope control's numbers and the list never
 * disagree.
 *
 * **Watched is the whole of it.** Reading every repository an installation
 * reaches so that yours and your review requests could come from anywhere cost
 * one page view a request per pull request per repository — on an account with
 * 79 of them, a burst GitHub answers with a secondary limit (#247), from the
 * moment a reader watched their first. The cheap way to find your pull
 * requests outside what you watch is one search, not 79 listings
 * (`0.2-pull-requests.md` §Identity); until that exists, the queue shows what
 * you asked it to watch.
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
      this.watched.watched(scope),
      this.access.viewerLogin(scope),
    ]);
    // A repository GitHub will not answer costs its own rows, not the queue (#244).
    // One budget for the whole view: the rows all draw, and as many of them as
    // it allows come back filled, the rest on the reads after this one (#247).
    const budget = this.access.readBudget();
    const reads = await Promise.all(
      repositories.map((repository) => this.access.openPullRequests(scope, repository, budget)),
    );
    const now = new Date();
    const rows = reads.flatMap((read) =>
      read.snapshots.map((snapshot) => this.mapper.toRow(snapshot, viewerLogin, now)),
    );
    return this.mapper.toQueue(rows, queue, viewerLogin, reads);
  }
}
