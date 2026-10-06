import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { GithubErrors } from '../../../github/domain/github.errors';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { SubmitPullRequestReviewCommand } from './submit-pull-request-review.command';

const EVENTS = {
  comment: 'COMMENT',
  approve: 'APPROVE',
  request_changes: 'REQUEST_CHANGES',
} as const;

/**
 * Submits a review in the caller's own name, with the line comments pending in
 * the console. Approve is "approve and merge": the approval posts, then a merge
 * is attempted, and when GitHub will not merge yet — a check still running,
 * another review required — the pull request waits rather than anything being
 * forced. What happened to the merge is the one thing answered.
 */
@CommandHandler(SubmitPullRequestReviewCommand)
export class SubmitPullRequestReviewCommandHandler
  implements ICommandHandler<SubmitPullRequestReviewCommand, { merged: boolean }>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  async execute({
    scope,
    address,
    review,
  }: SubmitPullRequestReviewCommand): Promise<{ merged: boolean }> {
    await this.access.submitReview(scope, scope.userId, address, {
      event: EVENTS[review.verdict],
      body: review.body,
      comments: review.comments,
    });
    if (review.verdict !== 'approve') return { merged: false };
    try {
      await this.access.merge(scope, scope.userId, address, 'squash');
      return { merged: true };
    } catch (error) {
      if (error instanceof AppError && error.code === GithubErrors.MERGE_REFUSED.code)
        return { merged: false };
      throw error;
    }
  }
}
