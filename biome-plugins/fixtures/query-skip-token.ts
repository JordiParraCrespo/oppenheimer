// Cases for ../query-skip-token.grit. See README.md.
import { skipToken, type UseQueryOptions, useQuery } from '@tanstack/react-query';

const thingsKeys = {
  all: ['things'] as const,
  lists: () => [...thingsKeys.all, 'list'] as const,
  list: () => [...thingsKeys.lists()] as const,
  detail: (id: string | undefined) => [...thingsKeys.all, 'detail', id] as const,
};
const fetchThing = async (id: string) => ({ id });
const fetchThings = async () => [{ id: '1' }];

export function useEnabledBeside(id: string | undefined) {
  return useQuery({
    queryKey: thingsKeys.detail(id),
    queryFn: () => fetchThing(id as string),
    // biome-ignore lint/plugin/query-skip-token: the owner of the queryFn gates with enabled
    enabled: Boolean(id),
  });
}

export function useCompoundBeside(id: string | undefined, open: boolean) {
  return useQuery<{ id: string }>({
    queryKey: thingsKeys.detail(id),
    queryFn: () => fetchThing(id as string),
    // biome-ignore lint/plugin/query-skip-token: any spelling, generic call included
    enabled: !!id && open,
  });
}

export function useSkipToken(id: string | undefined) {
  return useQuery({
    queryKey: thingsKeys.detail(id),
    queryFn: id ? () => fetchThing(id) : skipToken,
  });
}

export function useThings(
  options?: Omit<UseQueryOptions<{ id: string }[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({ queryKey: thingsKeys.list(), queryFn: fetchThings, ...options });
}

export function useWhenOpen(open: boolean) {
  // A condition a caller passes into a wrapper's options: no queryFn beside it.
  return useThings({ enabled: open });
}
