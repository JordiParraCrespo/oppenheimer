/** The part of a `useMutation` result {@link lastFailure} reads. */
export interface TrackedMutation {
  error: Error | null;
  /** When the last `mutate` was called; `0` for one never called. */
  submittedAt: number;
  reset: () => void;
}

export interface LastFailure {
  /** The failure of the mutation submitted last, or `null` if it did not fail. */
  error: Error | null;
  /**
   * Which of the mutations it was, by its position in the list — so a caller
   * can read that mutation's own `variables` (which automation, which row)
   * without comparing errors. `-1` when nothing failed.
   */
  index: number;
  /** Clear the alert: resets every mutation in the list that holds a failure. */
  dismiss: () => void;
}

/**
 * One alert for several mutations, without the stale error.
 *
 * `a.error ?? b.error` keeps showing `a`'s failure after `b` succeeds. This
 * answers the mutation submitted **last**: its error if it failed, nothing
 * otherwise, so a later success clears an earlier failure and a later failure
 * replaces it. Two submitted in the same millisecond resolve to the one later
 * in the list.
 *
 * Dismiss resets every failed mutation: resetting only the one showing would
 * hand "last submitted" to an older failure, and the closed alert would return.
 * A plain function, not a hook: it calls no React API.
 */
export function lastFailure(mutations: readonly TrackedMutation[]): LastFailure {
  let index = -1;
  mutations.forEach((mutation, position) => {
    if (mutation.submittedAt === 0) return;
    const latest = mutations[index];
    if (!latest || mutation.submittedAt >= latest.submittedAt) index = position;
  });
  const error = mutations[index]?.error ?? null;
  return {
    error,
    index: error ? index : -1,
    dismiss: () => {
      for (const mutation of mutations) if (mutation.error) mutation.reset();
    },
  };
}
