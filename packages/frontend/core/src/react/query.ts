import {
  type DefaultError,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
  useQueries as useTanstackQueries,
  useQuery as useTanstackQuery,
  useSuspenseQuery as useTanstackSuspenseQuery,
} from '@tanstack/react-query';
import { shareEntities } from './share-entities';

/**
 * TanStack Query's `useQuery`, sharing entities across refetches by default
 * ({@link shareEntities}). Every query hook in a product package's React layer
 * goes through this; `pnpm check:structure` fences TanStack's own
 * `useQuery` and `useQueries` out of those files. A query that must not share
 * passes `structuralSharing: false`.
 */
export function useQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>): UseQueryResult<TData, TError> {
  return useTanstackQuery({ structuralSharing: shareEntities, ...options });
}

/**
 * TanStack Query's `useQueries`, with each entry sharing entities as
 * {@link useQuery} does. Typed as TanStack's own: its generics are a tuple walk
 * over the entries, which this wrapper passes through untouched.
 */
export const useQueries = ((options: { queries: readonly object[] }) =>
  useTanstackQueries({
    ...options,
    queries: options.queries.map((query) => ({ structuralSharing: shareEntities, ...query })),
  } as never)) as typeof useTanstackQueries;

/**
 * TanStack Query's `useSuspenseQuery`, sharing entities as {@link useQuery}
 * does. The component that calls it suspends until the first answer and
 * throws a first failure to the nearest error boundary, so `data` is never
 * `undefined`: loading is the `<Suspense>` above it, failure the kit's
 * `QueryErrorBoundary`. A later failure over data already drawn does not
 * throw; it is `error` on the result, for the reader to show beside the data.
 */
export function useSuspenseQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseSuspenseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseSuspenseQueryResult<TData, TError> {
  return useTanstackSuspenseQuery({ structuralSharing: shareEntities, ...options });
}
