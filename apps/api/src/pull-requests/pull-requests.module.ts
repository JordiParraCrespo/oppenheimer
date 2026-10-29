import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GithubModule } from '../github/github.module';
import { WatchedRepositoriesResolver } from './application/watched-repositories.resolver';
import { CiFindingMapper } from './ci-finding.mapper';
import { AddPullRequestCommentCommandHandler } from './commands/add-pull-request-comment/add-pull-request-comment.command-handler';
import { AddPullRequestCommentHttpController } from './commands/add-pull-request-comment/add-pull-request-comment.http.controller';
import { AddPullRequestConversationCommentCommandHandler } from './commands/add-pull-request-conversation-comment/add-pull-request-conversation-comment.command-handler';
import { MergePullRequestCommandHandler } from './commands/merge-pull-request/merge-pull-request.command-handler';
import { MergePullRequestHttpController } from './commands/merge-pull-request/merge-pull-request.http.controller';
import { RecordCiFindingsCommandHandler } from './commands/record-ci-findings/record-ci-findings.command-handler';
import { SetRepositoryWatchCommandHandler } from './commands/set-repository-watch/set-repository-watch.command-handler';
import { SetRepositoryWatchHttpController } from './commands/set-repository-watch/set-repository-watch.http.controller';
import { StartReviewSessionCommandHandler } from './commands/start-review-session/start-review-session.command-handler';
import { StartReviewSessionHttpController } from './commands/start-review-session/start-review-session.http.controller';
import { SubmitPullRequestReviewCommandHandler } from './commands/submit-pull-request-review/submit-pull-request-review.command-handler';
import { SubmitPullRequestReviewHttpController } from './commands/submit-pull-request-review/submit-pull-request-review.http.controller';
import { CiFindingOrmEntity } from './database/ci-finding.orm-entity';
import { CiFindingRepository } from './database/ci-finding.repository';
import { ReviewSessionOrmEntity } from './database/review-session.orm-entity';
import { ReviewSessionRepository } from './database/review-session.repository';
import { WatchedRepositoryOrmEntity } from './database/watched-repository.orm-entity';
import { WatchedRepositoryRepository } from './database/watched-repository.repository';
import { PullRequestMapper } from './pull-request.mapper';
import {
  CI_FINDING_REPOSITORY,
  REVIEW_SESSION_REPOSITORY,
  WATCHED_REPOSITORY_REPOSITORY,
} from './pull-requests.di-tokens';
import { PullRequestResource } from './pull-requests.resource';
import { FindPullRequestHttpController } from './queries/find-pull-request/find-pull-request.http.controller';
import { FindPullRequestQueryHandler } from './queries/find-pull-request/find-pull-request.query-handler';
import { FindPullRequestActivityHttpController } from './queries/find-pull-request-activity/find-pull-request-activity.http.controller';
import { FindPullRequestActivityQueryHandler } from './queries/find-pull-request-activity/find-pull-request-activity.query-handler';
import { FindPullRequestAnalyticsHttpController } from './queries/find-pull-request-analytics/find-pull-request-analytics.http.controller';
import { FindPullRequestAnalyticsQueryHandler } from './queries/find-pull-request-analytics/find-pull-request-analytics.query-handler';
import { FindPullRequestCommentsHttpController } from './queries/find-pull-request-comments/find-pull-request-comments.http.controller';
import { FindPullRequestCommentsQueryHandler } from './queries/find-pull-request-comments/find-pull-request-comments.query-handler';
import { FindPullRequestFilesHttpController } from './queries/find-pull-request-files/find-pull-request-files.http.controller';
import { FindPullRequestFilesQueryHandler } from './queries/find-pull-request-files/find-pull-request-files.query-handler';
import { FindPullRequestsHttpController } from './queries/find-pull-requests/find-pull-requests.http.controller';
import { FindPullRequestsQueryHandler } from './queries/find-pull-requests/find-pull-requests.query-handler';
import { FindReviewSessionsHttpController } from './queries/find-review-sessions/find-review-sessions.http.controller';
import { FindReviewSessionsQueryHandler } from './queries/find-review-sessions/find-review-sessions.query-handler';
import { FindWatchedRepositoriesHttpController } from './queries/find-watched-repositories/find-watched-repositories.http.controller';
import { FindWatchedRepositoriesQueryHandler } from './queries/find-watched-repositories/find-watched-repositories.query-handler';

// Static routes before parameterized ones.
const httpControllers = [
  FindPullRequestsHttpController,
  FindPullRequestAnalyticsHttpController,
  FindWatchedRepositoriesHttpController,
  FindReviewSessionsHttpController,
  SetRepositoryWatchHttpController,
  FindPullRequestHttpController,
  FindPullRequestFilesHttpController,
  FindPullRequestCommentsHttpController,
  FindPullRequestActivityHttpController,
  SubmitPullRequestReviewHttpController,
  AddPullRequestCommentHttpController,
  MergePullRequestHttpController,
  StartReviewSessionHttpController,
];

const commandHandlers: Provider[] = [
  SetRepositoryWatchCommandHandler,
  RecordCiFindingsCommandHandler,
  SubmitPullRequestReviewCommandHandler,
  AddPullRequestCommentCommandHandler,
  AddPullRequestConversationCommentCommandHandler,
  MergePullRequestCommandHandler,
  StartReviewSessionCommandHandler,
];

const queryHandlers: Provider[] = [
  FindPullRequestsQueryHandler,
  FindPullRequestQueryHandler,
  FindPullRequestFilesQueryHandler,
  FindPullRequestCommentsQueryHandler,
  FindPullRequestActivityQueryHandler,
  FindWatchedRepositoriesQueryHandler,
  FindPullRequestAnalyticsQueryHandler,
  FindReviewSessionsQueryHandler,
];

/**
 * The Pull requests area (`product/next-steps/0.2-pull-requests-api-plan.md`):
 * the queue, a pull request's briefing, files and comments, reviews and merges
 * in the caller's own name, and analytics. Pull requests are GitHub's, read
 * through `PULL_REQUEST_ACCESS`; what this module keeps is which repositories a
 * person watches, the review sessions they started from a pull request, and
 * the rules — lanes, what holds a pull request — it sorts
 * them by.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      WatchedRepositoryOrmEntity,
      ReviewSessionOrmEntity,
      CiFindingOrmEntity,
    ]),
    AuthzKernelModule.forFeature([PullRequestResource]),
    GithubModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    PullRequestMapper,
    CiFindingMapper,
    WatchedRepositoriesResolver,
    { provide: WATCHED_REPOSITORY_REPOSITORY, useClass: WatchedRepositoryRepository },
    { provide: REVIEW_SESSION_REPOSITORY, useClass: ReviewSessionRepository },
    { provide: CI_FINDING_REPOSITORY, useClass: CiFindingRepository },
  ],
})
export class PullRequestsModule {}
