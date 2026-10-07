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
        counted: [],
        viewerLogin: null,
        now,
        complete: true,
        unreadable: [],
      });
    }
    const openBudget = this.access.readBudget();
    const closedBudget = this.access.readBudget();
    const [repositories, viewerLogin] = await Promise.all([
      this.watched.watched(scope),
      this.access.viewerLogin(scope),
    ]);
    // The closed reads are capped, newest first, so a page view costs the window
    // and not the installation (#247). The counts and the day chart are the
    // listings', which every pull request has; the medians, the lane mix and
    // the waiting breakdown are what was read, and deepen over the next few
    // reads as more parts land in the cache.
    //
    // A budget each, because the two halves answer different questions: the
    // waiting breakdown is the open pull requests', the lane mix and the
    // medians mostly the closed ones'. Sharing one made which half got the
    // slots depend on whichever Redis miss resumed first, so a view could
    // spend everything on open rows and draw no lane mix at all, or the
    // reverse, with nothing in the code saying which.
    const [open, closed] = await Promise.all([
      Promise.all(
        repositories.map((repository) =>
          this.access.openPullRequests(scope, repository, openBudget),
        ),
      ),
      this.access.closedPullRequests(
        scope,
        repositories,
        window.previousFrom,
        CLOSED_CEILING,
        closedBudget,
      ),
    ]);
    return this.mapper.toAnalytics({
      range,
      window,
      open: open.flatMap((read) => read.snapshots),
      closed: closed.pulls.flatMap((read) => read.snapshots),
      counted: closed.counted,
      viewerLogin,
      now,
      complete: closed.complete,
      unreadable: this.mapper.toUnreadable([...open, ...closed.pulls]),
    });
  }
}
