// Cases for ../query-key-factory.grit. See README.md.
import { infiniteQueryOptions, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

const thingsKeys = {
  all: ['things'] as const,
  lists: () => [...thingsKeys.all, 'list'] as const,
  detail: (id: string) => [...thingsKeys.all, 'detail', id] as const,
};
const fetchThing = async () => ({ id: '1' });

export function useLiteral() {
  // biome-ignore lint/plugin/query-key-factory: an array literal no invalidation can find by name
  return useQuery<{ id: string }>({ queryKey: ['things'], queryFn: fetchThing });
}

export function useSpreadLiteral(id: string) {
  // biome-ignore lint/plugin/query-key-factory: a hand-built key beside the factory
  return useQuery({ queryKey: [...thingsKeys.all, 'detail', id], queryFn: fetchThing });
}

export function useRoot() {
  // biome-ignore lint/plugin/query-key-factory: the root handed to a query
  return useQuery<{ id: string }>({ queryKey: thingsKeys.all, queryFn: fetchThing });
}

export function useMany(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      // biome-ignore lint/plugin/query-key-factory: a useQueries entry is a query too
      queryKey: ['things', id],
      queryFn: fetchThing,
    })),
  });
}

export const pages = infiniteQueryOptions({
  // biome-ignore lint/plugin/query-key-factory: every TanStack helper, not a list of them
  queryKey: thingsKeys.all,
  queryFn: fetchThing,
  initialPageParam: 0,
  getNextPageParam: () => null,
});

export function useFromTheFactory(id: string) {
  return useQuery({ queryKey: thingsKeys.detail(id), queryFn: fetchThing });
}

export function useInvalidateEverything() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: thingsKeys.all });
}
