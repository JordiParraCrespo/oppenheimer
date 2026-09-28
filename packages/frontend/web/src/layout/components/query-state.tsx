import type { ReactNode } from 'react';
import { ErrorAlert } from '../../forms';

/** The part of a query result {@link QueryState} branches on. */
export interface QueryStateSource<T> {
  isPending: boolean;
  error: unknown;
  data: T | undefined;
}

/**
 * Several reads as one source, for a section that can draw nothing until all
 * of them have answered: pending while any is, failed with the first failure,
 * and `combine`d once every one holds data. The sessions sidebar groups its
 * sessions under their projects, so it needs both.
 */
export function combineQueries<A, B, T>(
  a: QueryStateSource<A>,
  b: QueryStateSource<B>,
  combine: (a: A, b: B) => T,
): QueryStateSource<T> {
  const settled = a.data !== undefined && b.data !== undefined;
  return {
    isPending: a.isPending || b.isPending,
    error: a.error ?? b.error ?? null,
    data: settled ? combine(a.data as A, b.data as B) : undefined,
  };
}

/**
 * The four states of a read, in one order: failed, still loading, empty, or
 * there. A section wrote this ladder by hand in eight places, and three of
 * them left a rung out — a failed read spun a skeleton for ever, or read as
 * "No projects".
 *
 * A failure the section cannot draw around is shown instead of everything
 * else, through `ErrorAlert` with the section's `errorFallback`, or through
 * `renderError` where the section says it its own way (a screen's `RouteError`,
 * a 404's "not found"). What a later failure does to data already on screen is
 * the section's call, named once: `stale="replace"` (the default) shows the
 * failure in its place; `stale="keep"` keeps drawing the data it has and puts
 * the failure above it — a page of runs that a refetch failed to replace is
 * still the page the reader was reading.
 *
 * It takes the query the section already holds and moves no subscription: the
 * component that calls the hook is the one that renders this, as the render
 * rules ask. `children` is a function because the data only exists on the
 * last rung.
 */
export function QueryState<T>({
  query,
  pending,
  errorFallback,
  errorClassName,
  renderError,
  stale = 'replace',
  empty,
  children,
}: {
  query: QueryStateSource<T>;
  /** What holds the place until the first answer: skeletons, usually. */
  pending: ReactNode;
  /** Already translated: the failure's sentence when its code has none. */
  errorFallback: string;
  errorClassName?: string;
  renderError?: (error: unknown) => ReactNode;
  /** A failure after data arrived: show it instead (`replace`) or beside it (`keep`). */
  stale?: 'replace' | 'keep';
  /** What an empty answer shows, and what counts as empty. */
  empty?: { when: (data: T) => boolean; show: ReactNode };
  children: (data: T) => ReactNode;
}) {
  const { error, data } = query;
  const failed = error !== null && error !== undefined;
  const failure = failed ? (
    renderError ? (
      renderError(error)
    ) : (
      <ErrorAlert error={error} fallback={errorFallback} className={errorClassName} />
    )
  ) : null;

  if (failed && (stale === 'replace' || data === undefined)) return failure;
  if (data === undefined) return pending;
  const body = empty?.when(data) ? empty.show : children(data);
  return failed ? (
    <>
      {failure}
      {body}
    </>
  ) : (
    body
  );
}
