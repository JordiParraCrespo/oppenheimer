import type { PullRequestScope } from '@oppenheimer/shared';

/** What GitHub says about a pull request, in the words these rules need. */
export interface MergeFacts {
  draft: boolean;
  merged: boolean;
  state: 'open' | 'closed';
  /** Null while GitHub is still computing it. */
  mergeable: boolean | null;
  mergeableState: string;
  /** `unavailable` holds nothing here: GitHub refuses the merge itself if a required check is missing. */
  checks: 'passing' | 'failing' | 'running' | 'none' | 'unavailable';
  /** Each reviewer's latest verdict. */
  verdicts: readonly ('APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED')[];
}

/** What holds a pull request, first match wins, so the queue names the one thing to do next. */
export type MergeBlocker =
  | 'draft'
  | 'conflicts'
  | 'checks_failing'
  | 'checks_running'
  | 'changes_requested'
  | 'behind'
  | 'approval_required';

export function mergeBlocker(facts: MergeFacts): MergeBlocker | null {
  if (facts.merged || facts.state === 'closed') return null;
  if (facts.draft) return 'draft';
  if (facts.mergeable === false || facts.mergeableState === 'dirty') return 'conflicts';
  if (facts.checks === 'failing') return 'checks_failing';
  if (facts.checks === 'running') return 'checks_running';
  if (facts.verdicts.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (facts.mergeableState === 'behind') return 'behind';
  if (facts.mergeableState === 'blocked') return 'approval_required';
  return null;
}

export type GateState = 'done' | 'failed' | 'pending';

/** The path to merge: checks, conflicts, review, merge, each met, failed or still to come. */
export function mergeGates(
  facts: MergeFacts,
): Record<'checks' | 'conflicts' | 'review' | 'merge', GateState> {
  const approved =
    facts.verdicts.includes('APPROVED') && !facts.verdicts.includes('CHANGES_REQUESTED');
  return {
    checks:
      facts.checks === 'failing'
        ? 'failed'
        : facts.checks === 'running' || facts.checks === 'unavailable'
          ? 'pending'
          : 'done',
    conflicts:
      facts.mergeable === false || facts.mergeableState === 'dirty'
        ? 'failed'
        : facts.mergeable === null
          ? 'pending'
          : 'done',
    review: facts.verdicts.includes('CHANGES_REQUESTED') ? 'failed' : approved ? 'done' : 'pending',
    merge: facts.merged ? 'done' : 'pending',
  };
}

/** Each reviewer's latest verdict, oldest review first in, dismissals and pending drafts left out. */
export function latestVerdicts(
  reviews: readonly { login: string; state: string }[],
  authorLogin: string,
): ('APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED')[] {
  const byReviewer = new Map<string, 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'>();
  for (const review of reviews) {
    if (review.login === authorLogin) continue;
    if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED')
      byReviewer.set(review.login, review.state);
    else if (review.state === 'COMMENTED' && !byReviewer.has(review.login))
      byReviewer.set(review.login, 'COMMENTED');
  }
  return [...byReviewer.values()];
}

/** The branch every session pushes (`oppenheimer/<slug>`): how a pull request is known to be an agent's. */
export const SESSION_BRANCH_PREFIX = 'oppenheimer/';

export function isSessionBranch(headRef: string): boolean {
  return headRef.startsWith(SESSION_BRANCH_PREFIX);
}

/**
 * Whose queue a pull request is in: yours or your sessions', a review someone
 * asked of you, or the rest of what you watch. Without a GitHub login only the
 * sessions' are known to be yours, and nothing is a review request.
 */
export function scopeOf(
  pull: { authorLogin: string; headRef: string; requestedReviewers: readonly string[] },
  viewerLogin: string | null,
): PullRequestScope {
  if (isSessionBranch(pull.headRef) || (viewerLogin !== null && pull.authorLogin === viewerLogin))
    return 'mine';
  if (viewerLogin !== null && pull.requestedReviewers.includes(viewerLogin)) return 'requested';
  return 'watching';
}
