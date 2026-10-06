import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GithubModule } from '../github/github.module';
import { WatchedRepositoriesResolver } from './application/watched-repositories.resolver';
import { AddPullRequestCommentCommandHandler } from './commands/add-pull-request-comment/add-pull-request-comment.command-handler';
import { AddPullRequestCommentHttpController } from './commands/add-pull-request-comment/add-pull-request-comment.http.controller';
import { MergePullRequestCommandHandler } from './commands/merge-pull-request/merge-pull-request.command-handler';
import { MergePullRequestHttpController } from './commands/merge-pull-request/merge-pull-request.http.controller';
import { SetRepositoryWatchCommandHandler } from './commands/set-repository-watch/set-repository-watch.command-handler';
import { SetRepositoryWatchHttpController } from './commands/set-repository-watch/set-repository-watch.http.controller';
import { SubmitPullRequestReviewCommandHandler } from './commands/submit-pull-request-review/submit-pull-request-review.command-handler';
import { SubmitPullRequestReviewHttpController } from './commands/submit-pull-request-review/submit-pull-request-review.http.controller';
import { WatchedRepositoryOrmEntity } from './database/watched-repository.orm-entity';
import { WatchedRepositoryRepository } from './database/watched-repository.repository';
import { PullRequestMapper } from './pull-request.mapper';
import { WATCHED_REPOSITORY_REPOSITORY } from './pull-requests.di-tokens';
import { PullRequestResource } from './pull-requests.resource';
import { FindPullRequestHttpController } from './queries/find-pull-request/find-pull-request.http.controller';
import { FindPullRequestQueryHandler } from './queries/find-pull-request/find-pull-request.query-handler';
import { FindPullRequestAnalyticsHttpController } from './queries/find-pull-request-analytics/find-pull-request-analytics.http.controller';
import { FindPullRequestAnalyticsQueryHandler } from './queries/find-pull-request-analytics/find-pull-request-analytics.query-handler';
import { FindPullRequestCommentsHttpController } from './queries/find-pull-request-comments/find-pull-request-comments.http.controller';
import { FindPullRequestCommentsQueryHandler } from './queries/find-pull-request-comments/find-pull-request-comments.query-handler';
import { FindPullRequestFilesHttpController } from './queries/find-pull-request-files/find-pull-request-files.http.controller';
import { FindPullRequestFilesQueryHandler } from './queries/find-pull-request-files/find-pull-request-files.query-handler';
import { FindPullRequestsHttpController } from './queries/find-pull-requests/find-pull-requests.http.controller';
import { FindPullRequestsQueryHandler } from './queries/find-pull-requests/find-pull-requests.query-handler';
import { FindWatchedRepositoriesHttpController } from './queries/find-watched-repositories/find-watched-repositories.http.controller';
import { FindWatchedRepositoriesQueryHandler } from './queries/find-watched-repositories/find-watched-repositories.query-handler';

// Static routes before parameterized ones.
const httpControllers = [
  FindPullRequestsHttpController,
  FindPullRequestAnalyticsHttpController,
  FindWatchedRepositoriesHttpController,
  SetRepositoryWatchHttpController,
  FindPullRequestHttpController,
  FindPullRequestFilesHttpController,
  FindPullRequestCommentsHttpController,
  SubmitPullRequestReviewHttpController,
  AddPullRequestCommentHttpController,
  MergePullRequestHttpController,
];

const commandHandlers: Provider[] = [
  SetRepositoryWatchCommandHandler,
  SubmitPullRequestReviewCommandHandler,
  AddPullRequestCommentCommandHandler,
  MergePullRequestCommandHandler,
];

const queryHandlers: Provider[] = [
  FindPullRequestsQueryHandler,
  FindPullRequestQueryHandler,
  FindPullRequestFilesQueryHandler,
  FindPullRequestCommentsQueryHandler,
  FindWatchedRepositoriesQueryHandler,
  FindPullRequestAnalyticsQueryHandler,
];

/**
 * The Pull requests area (`product/next-steps/0.2-pull-requests-api-plan.md`):
 * the queue, a pull request's briefing, files and comments, reviews and merges
 * in the caller's own name, and analytics. Pull requests are GitHub's, read
 * through `PULL_REQUEST_ACCESS`; what this module keeps is which repositories a
 * person watches, and the rules — lanes, what holds a pull request — it sorts
 * them by.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([WatchedRepositoryOrmEntity]),
    AuthzKernelModule.forFeature([PullRequestResource]),
    GithubModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    PullRequestMapper,
    WatchedRepositoriesResolver,
    { provide: WATCHED_REPOSITORY_REPOSITORY, useClass: WatchedRepositoryRepository },
  ],
})
export class PullRequestsModule {}
