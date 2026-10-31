import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { PullRequestReadPort } from '../../../github/application/pull-request-read.port';
import { PULL_REQUEST_READS } from '../../../github/github.di-tokens';
import { CloseSessionCommand } from '../../../sessions/commands/close-session/close-session.command';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command';
import type { SessionCommandResult } from '../../../sessions/domain/session-command.types';
import { requireApp } from '../../application/app-address.policy';
import type { ReviewSessionRepositoryPort } from '../../database/review-session.repository.port';
import { PullRequestsErrors } from '../../domain/pull-requests.errors';
import { type ReviewedPullRequest, reviewSessionInput } from '../../domain/review-session.policy';
import { REVIEW_SESSION_REPOSITORY } from '../../pull-requests.di-tokens';
import { StartReviewSessionCommand } from './start-review-session.command';

/**
 * Starts a review session for a pull request: a worktree of its head branch
 * on the caller's host, Claude Code on the review prompt, through the same
 * command New session sends, with the origin `review` so the Sessions list
 * leaves it out; then the link that files it under the pull request.
 *
 * There is no transaction across the two modules, so a link that fails closes
 * the session it would have filed: an unlinked review session would run where
 * no list shows it. The session's idempotency key is derived from the pull
 * request and the caller's key, so a retry after a lost answer gets the same
 * session back, and the link is idempotent on the session.
 */
@CommandHandler(StartReviewSessionCommand)
export class StartReviewSessionCommandHandler
  implements ICommandHandler<StartReviewSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(PULL_REQUEST_READS)
    private readonly reads: PullRequestReadPort,
    @Inject(REVIEW_SESSION_REPOSITORY)
    private readonly reviews: ReviewSessionRepositoryPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: StartReviewSessionCommand): Promise<SessionCommandResult> {
    const { scope, userId, address } = command;
    // A session clones through the App.
    const app = requireApp(address);
    const { repository, pull } = await this.reads.pullRequest(scope, address);
    if (pull.fromFork)
      throw new AppError(PullRequestsErrors.REVIEW_FROM_FORK, {
        detail: `${repository.fullName}#${pull.number} comes from a fork`,
      });
    const reviewed: ReviewedPullRequest = {
      installationId: app.installationId,
      githubRepoId: address.githubRepoId,
      repository: repository.fullName,
      number: pull.number,
      title: pull.title,
      headRef: pull.headRef,
      baseRef: pull.baseRef,
    };

    const result = await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
      new CreateSessionCommand({
        scope,
        userId,
        input: reviewSessionInput(reviewed, command.hostId),
        idempotencyKey: command.idempotencyKey
          ? `review:${app.installationId}:${address.githubRepoId}:${address.number}:${command.idempotencyKey}`
          : null,
        origin: 'review',
      }),
    );

    const sessionId = String(result.sessionId);
    try {
      await this.reviews.link(scope, { sessionId, ...reviewed });
    } catch (error) {
      // An unlinked review session is listed nowhere: not under Sessions (its
      // origin) and not under For review (no link). Close it rather than leave
      // it running unseen; a retry with the same key starts afresh.
      await this.commandBus
        .execute(new CloseSessionCommand({ scope, sessionId, acceptUnpushedWork: true }))
        .catch(() => undefined);
      throw error;
    }
    return result;
  }
}
