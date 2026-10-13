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
  approve_and_merge: 'APPROVE',
  request_changes: 'REQUEST_CHANGES',
} as const;

type Submitted = { merged: boolean; autoMerge: boolean };

/**
 * Submits a review in the caller's own name, with the line comments pending in
 * the console. Approve only approves; the caller merges later. Approve and
 * merge posts the approval, then merges at once when GitHub allows it, and
 * otherwise turns on GitHub's auto-merge so it merges once the required checks
 * pass. When the repository does not allow auto-merge the pull request waits
 * rather than anything being forced. What happened to the merge is the one
 * thing answered.
 */
@CommandHandler(SubmitPullRequestReviewCommand)
export class SubmitPullRequestReviewCommandHandler
  implements ICommandHandler<SubmitPullRequestReviewCommand, Submitted>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  async execute({ scope, address, review }: SubmitPullRequestReviewCommand): Promise<Submitted> {
    await this.access.submitReview(scope, scope.userId, address, {
      event: EVENTS[review.verdict],
      body: review.body,
      comments: review.comments,
    });
    if (review.verdict !== 'approve_and_merge') return { merged: false, autoMerge: false };
    try {
      await this.access.merge(scope, scope.userId, address, 'squash');
      return { merged: true, autoMerge: false };
    } catch (error) {
      if (!(error instanceof AppError && error.code === GithubErrors.MERGE_REFUSED.code))
        throw error;
    }
    const autoMerge = await this.access.enableAutoMerge(scope, scope.userId, address, 'squash');
    return { merged: false, autoMerge };
  }
}
