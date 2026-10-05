import {
  type DefaultError,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  useQueries as useTanstackQueries,
  useQuery as useTanstackQuery,
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
