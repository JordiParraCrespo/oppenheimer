import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { WatchedRepositoriesResolver } from '../../application/watched-repositories.resolver';
import { analyticsWindow, CLOSED_CEILING } from '../../domain/pull-request-analytics.policy';
import type { PullRequestAnalyticsResponseDto } from '../../dtos/pull-request-analytics.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { FindPullRequestAnalyticsQuery } from './find-pull-request-analytics.query';

/**
 * The review period against the one before, over the watched repositories:
 * computed from GitHub's own answers on each read — the open pull requests and
 * those closed since the previous period began — with nothing stored. Medians,
 * never means.
 */
@QueryHandler(FindPullRequestAnalyticsQuery)
export class FindPullRequestAnalyticsQueryHandler
  implements IQueryHandler<FindPullRequestAnalyticsQuery, PullRequestAnalyticsResponseDto>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
    private readonly watched: WatchedRepositoriesResolver,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({
    scope,
    range,
  }: FindPullRequestAnalyticsQuery): Promise<PullRequestAnalyticsResponseDto> {
    const now = new Date();
    const window = analyticsWindow(range, now);
    // A period over no repository is a period of nothing, and our own rows say
    // so before GitHub is asked anything (#247).
    if (!(await this.watched.anyWatched(scope))) {
      return this.mapper.toAnalytics({
        range,
        window,
        open: [],
        closed: [],
        viewerLogin: null,
        now,
        complete: true,
        unreadable: [],
      });
    }
    const [repositories, viewerLogin] = await Promise.all([
      this.watched.watched(scope),
      this.access.viewerLogin(scope.userId),
    ]);
    // The closed reads are capped, newest first, so a page view costs the window and not the installation (#247).
    const [open, closed] = await Promise.all([
      Promise.all(
        repositories.map((repository) => this.access.openPullRequests(scope, repository)),
      ),
      this.access.closedPullRequests(scope, repositories, window.previousFrom, CLOSED_CEILING),
    ]);
    return this.mapper.toAnalytics({
      range,
      window,
      open: open.flatMap((read) => read.snapshots),
      closed: closed.pulls.flatMap((read) => read.snapshots),
      viewerLogin,
      now,
      complete: closed.complete,
      unreadable: this.mapper.toUnreadable([...open, ...closed.pulls]),
    });
  }
}
