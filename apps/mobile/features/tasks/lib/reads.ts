/** The part of a query result that says whether there is anything to draw. */
export interface Read {
  isPending: boolean;
  isError: boolean;
  data: unknown;
  refetch: () => unknown;
}

export type ReadsState = 'pending' | 'failed' | 'ready';

/**
 * Where the reads one part of a page draws from stand together: `failed` when
 * any of them failed with nothing to show (it wins over one still pending, so
 * Try again is offered at once), `pending` while any has not answered, and
 * `ready` once all have data. A refetch that fails over data already drawn
 * stays `ready`. Never `ready` on an empty fallback: a missing list is not an
 * empty one.
 */
export function readsState(reads: readonly Read[]): ReadsState {
  if (reads.some((read) => read.isError && read.data === undefined)) return 'failed';
  if (reads.some((read) => read.isPending)) return 'pending';
  return 'ready';
}

/** Try again: reads again the ones that failed with nothing to show. */
export function retryFailed(reads: readonly Read[]): void {
  for (const read of reads) {
    if (read.isError && read.data === undefined) void read.refetch();
  }
}
