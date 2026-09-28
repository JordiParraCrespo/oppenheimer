import type { ReactNode } from 'react';
import { ErrorAlert } from '../../forms';

/** The part of a query result {@link QueryState} branches on. */
export interface QueryStateSource<T> {
  isPending: boolean;
  error: unknown;
  data: T | undefined;
}

/**
 * The four states of a read, in one order: failed, still loading, empty, or
 * there. A section wrote this ladder by hand in eight places, and three of
 * them left a rung out — a failed read spun a skeleton for ever, or read as
 * "No projects".
 *
 * A failure wins over everything, so a read that failed is never shown as
 * loading or as empty. It renders through `ErrorAlert` with the section's own
 * `errorFallback`, or through `renderError` when the section says it
 * differently (a screen's `RouteError`).
 *
 * It takes the query the section already holds and moves no subscription: the
 * component that calls the hook is the one that renders this, as the render
 * rules ask. Several reads branch as one when the caller hands a source it
 * built from them — the sidebar waits for its sessions *and* its projects.
 * `children` is a function because the data only exists on the last rung.
 */
export function QueryState<T>({
  query,
  pending,
  errorFallback,
  errorClassName,
  renderError,
  isEmpty,
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
  isEmpty?: (data: T) => boolean;
  /** Shown when `isEmpty` says so; without it, an empty read renders `children`. */
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { error, data } = query;
  if (error !== null && error !== undefined) {
    return renderError ? (
      renderError(error)
    ) : (
      <ErrorAlert error={error} fallback={errorFallback} className={errorClassName} />
    );
  }
  if (query.isPending || data === undefined) return pending;
  if (empty !== undefined && isEmpty?.(data)) return empty;
  return children(data);
}
