'use client';

/** The part of a `useMutation` result {@link useLastFailure} reads. */
export interface TrackedMutation {
  error: Error | null;
  /** When the last `mutate` was called; `0` for one never called. */
  submittedAt: number;
  reset: () => void;
}

export interface LastFailure {
  /** The failure of the mutation submitted last, or `null` if it did not fail. */
  error: Error | null;
  /** Forget it: resets the mutation it came from. */
  dismiss: () => void;
}

/**
 * One alert for several mutations, without the stale error.
 *
 * `a.error ?? b.error` keeps showing `a`'s failure after `b` succeeds, and
 * nothing can clear it. This answers the mutation that was submitted **last**
 * instead: its error if it failed, nothing if it succeeded or is still
 * running. So a later success clears an earlier failure, a later failure
 * replaces it, and `dismiss` resets whichever one is showing.
 */
export function useLastFailure(...mutations: TrackedMutation[]): LastFailure {
  let latest: TrackedMutation | undefined;
  for (const mutation of mutations) {
    if (mutation.submittedAt > 0 && (!latest || mutation.submittedAt >= latest.submittedAt)) {
      latest = mutation;
    }
  }
  return { error: latest?.error ?? null, dismiss: () => latest?.reset() };
}
