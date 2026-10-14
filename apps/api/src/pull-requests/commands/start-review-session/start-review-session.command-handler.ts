import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command';
import type { SessionCommandResult } from '../../../sessions/domain/session-command.types';
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
 * There is no transaction across the two modules. The session's idempotency
 * key is derived from the pull request and the caller's key, so a retry after
 * the session was made gets it back, and the link is idempotent on the session.
 */
@CommandHandler(StartReviewSessionCommand)
export class StartReviewSessionCommandHandler
  implements ICommandHandler<StartReviewSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
    @Inject(REVIEW_SESSION_REPOSITORY)
    private readonly reviews: ReviewSessionRepositoryPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: StartReviewSessionCommand): Promise<SessionCommandResult> {
    const { scope, userId, address } = command;
    const { repository, pull } = await this.access.pullRequest(scope, address);
    if (pull.fromFork)
      throw new AppError(PullRequestsErrors.REVIEW_FROM_FORK, {
        detail: `${repository.fullName}#${pull.number} comes from a fork`,
      });
    const reviewed: ReviewedPullRequest = {
      installationId: address.installationId,
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
          ? `review:${address.installationId}:${address.githubRepoId}:${address.number}:${command.idempotencyKey}`
          : null,
        origin: 'review',
      }),
    );

    // The session exists whatever happens next; a link that fails is retried
    // with the same key and finds it.
    await this.reviews.link(scope, { sessionId: String(result.sessionId), ...reviewed });
    return result;
  }
}
