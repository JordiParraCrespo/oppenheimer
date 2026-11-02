import type { GithubChecks } from './github-pulls.port';

/**
 * The rules both reads of a pull request apply to what GitHub says, kept in
 * one place: the REST adapter and the queue's GraphQL read name the same
 * values in different cases, and a rule that drifted between them would sort
 * a pull request into another lane with nothing failing.
 */

export type CheckOutcome = 'passed' | 'failed' | 'pending';

/** A check run, from its status and conclusion in either API's case. */
export function checkRunOutcome(
  status: string,
  conclusion: string | null | undefined,
): CheckOutcome {
  if (status.toLowerCase() !== 'completed') return 'pending';
  return ['success', 'neutral', 'skipped'].includes((conclusion ?? '').toLowerCase())
    ? 'passed'
    : 'failed';
}

/** A commit status, the older way a repository may report a check. */
export function commitStatusOutcome(state: string): CheckOutcome {
  const lowered = state.toLowerCase();
  if (lowered === 'success') return 'passed';
  // GraphQL's `EXPECTED` is a required status nothing has reported yet.
  return lowered === 'pending' || lowered === 'expected' ? 'pending' : 'failed';
}

/** The head's checks, counted together: one failure fails it, then one still running keeps it running. */
export function checksOf(outcomes: CheckOutcome[]): GithubChecks {
  const count = (outcome: CheckOutcome) => outcomes.filter((o) => o === outcome).length;
  const failed = count('failed');
  const pending = count('pending');
  return {
    state:
      outcomes.length === 0 ? 'none' : failed > 0 ? 'failing' : pending > 0 ? 'running' : 'passing',
    total: outcomes.length,
    passed: count('passed'),
    failed,
    pending,
  };
}

/**
 * Whether the head branch lives in another repository than the base. A head
 * whose repository is gone (a deleted fork) has no id, and is a fork's too.
 */
export function fromForkOf(
  headRepositoryId: string | number | null | undefined,
  baseRepositoryId: string | number | null | undefined,
): boolean {
  return (headRepositoryId ?? undefined) !== (baseRepositoryId ?? undefined);
}
