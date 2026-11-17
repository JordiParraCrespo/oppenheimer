import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { createContext, type RefObject, use, useId, useLayoutEffect, useRef } from 'react';

/** A section's own Try again, read when the scope's is pressed. */
export type OfflineRetry = RefObject<(() => void) | undefined>;

/** Hand a section's offline failure to the enclosing `OfflineOnce`; returns the release. */
export const OfflineOnceContext = createContext<
  ((id: string, retry: OfflineRetry) => () => void) | null
>(null);

/**
 * `error`, unless it is an offline failure inside an `OfflineOnce`, which
 * then draws it: the section shows what this returns. `retry` is the
 * section's own Try again, run by the scope's.
 */
export function useOfflineOnce<TError>(error: TError, retry?: () => void): TError | null {
  const handOver = use(OfflineOnceContext);
  const resolveError = useErrorMessage();
  const id = useId();
  const latest = useRef(retry);
  // Keeps the scope's Try again on this section's latest retry.
  useLayoutEffect(() => {
    latest.current = retry;
  });
  const handed =
    handOver !== null && error !== null && error !== undefined && resolveError(error).unreachable;
  // Syncs with the enclosing OfflineOnce, which draws the failure while it is handed
  // over; before paint, so the section's own alert and the scope's never both show.
  useLayoutEffect(() => {
    if (handed && handOver) return handOver(id, latest);
  }, [handed, handOver, id]);
  return handed ? null : error;
}
