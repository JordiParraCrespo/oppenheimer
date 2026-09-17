'use client';

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { HostEntity, HostPairing } from '../modules/hosts/host.entity';
import { useConsumerApp } from './context';

/**
 * Query key factory for the `hosts` feature, from the most generic (`all`) to
 * the most specific so a whole subtree can be invalidated with one key.
 */
export const hostsKeys = {
  all: ['hosts'] as const,
  lists: () => [...hostsKeys.all, 'list'] as const,
  list: () => [...hostsKeys.lists()] as const,
};

/** The hosts the caller has paired: the Settings → Hosts list and New session's host chip. */
export function useHosts(
  options?: Omit<UseQueryOptions<HostEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: hostsKeys.list(),
    queryFn: () => app.hosts.findAll(),
    ...options,
  });
}

/**
 * Mint the install command Add host shows. The host list is not invalidated
 * here: the host only appears once its runner dials in, which the list learns
 * of on its next refetch.
 */
export function usePairHost(options?: UseMutationOptions<HostPairing, Error, void>) {
  const app = useConsumerApp();

  return useMutation({
    mutationFn: () => app.hosts.pair(),
    ...options,
  });
}

export function useRemoveHost(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.hosts.remove(id),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: hostsKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}
