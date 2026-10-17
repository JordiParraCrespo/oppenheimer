import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { SubmitPullRequestReviewDto } from '@oppenheimer/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PullRequestAccessPort } from '../../../../github/application/pull-request-access.port';
import { GithubErrors } from '../../../../github/domain/github.errors';
import { SubmitPullRequestReviewCommand } from '../submit-pull-request-review.command';
import { SubmitPullRequestReviewCommandHandler } from '../submit-pull-request-review.command-handler';

/**
 * The two approvals: Approve only approves and leaves the merge to the
 * reviewer; Approve and merge merges now when GitHub lets it, and otherwise
 * hands the merge to GitHub's auto-merge. GitHub's own refusals are the
 * adapter's, covered by the GitHub module.
 */
const SCOPE: AccessScope = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const ADDRESS = { installationId: 'inst', githubRepoId: 1, number: 7 };

function access(merge: () => Promise<void>, autoMerge = true) {
  return {
    submitReview: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn(merge),
    enableAutoMerge: vi.fn().mockResolvedValue(autoMerge),
  } satisfies Pick<PullRequestAccessPort, 'submitReview' | 'merge' | 'enableAutoMerge'>;
}

function submit(port: ReturnType<typeof access>, verdict: SubmitPullRequestReviewDto['verdict']) {
  return new SubmitPullRequestReviewCommandHandler(
    port as unknown as PullRequestAccessPort,
  ).execute(
    new SubmitPullRequestReviewCommand({
      scope: SCOPE,
      address: ADDRESS,
      review: { verdict, comments: [] },
    }),
  );
}

const refused = () => Promise.reject(new AppError(GithubErrors.MERGE_REFUSED));

describe('submitting a review', () => {
  it('approves without merging when the verdict is Approve', async () => {
    const port = access(() => Promise.resolve());
    await expect(submit(port, 'approve')).resolves.toEqual({ merged: false, autoMerge: false });
    expect(port.submitReview).toHaveBeenCalledWith(SCOPE, 'user-1', ADDRESS, {
      event: 'APPROVE',
      body: undefined,
      comments: [],
    });
    expect(port.merge).not.toHaveBeenCalled();
    expect(port.enableAutoMerge).not.toHaveBeenCalled();
  });

  it('merges at once when GitHub allows it, and asks for no auto-merge', async () => {
    const port = access(() => Promise.resolve());
    await expect(submit(port, 'approve_and_merge')).resolves.toEqual({
      merged: true,
      autoMerge: false,
    });
    expect(port.submitReview.mock.calls[0]?.[3]).toMatchObject({ event: 'APPROVE' });
    expect(port.enableAutoMerge).not.toHaveBeenCalled();
  });

  it('turns on auto-merge when GitHub will not merge yet', async () => {
    const port = access(refused);
    await expect(submit(port, 'approve_and_merge')).resolves.toEqual({
      merged: false,
      autoMerge: true,
    });
    expect(port.enableAutoMerge).toHaveBeenCalledWith(SCOPE, 'user-1', ADDRESS, 'squash');
  });

  it('leaves the pull request waiting when the repository does not allow auto-merge', async () => {
    const port = access(refused, false);
    await expect(submit(port, 'approve_and_merge')).resolves.toEqual({
      merged: false,
      autoMerge: false,
    });
  });

  it('passes any other merge failure on and asks for no auto-merge', async () => {
    const port = access(() => Promise.reject(new AppError(GithubErrors.USER_NOT_CONNECTED)));
    await expect(submit(port, 'approve_and_merge')).rejects.toMatchObject({ code: 'GITHUB_012' });
    expect(port.enableAutoMerge).not.toHaveBeenCalled();
  });
});
