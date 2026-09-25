'use client';

import { withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { HostEntity, HostPairing, HostPairingToken } from '../modules/hosts/host.entity';
import { useConsumerApp } from './context';

/**
 * Query key factory for the `hosts` feature, from the most generic (`all`) to
 * the most specific, one function per level so any subtree can be named:
 *
 * ```
 * ['hosts']                                   all
 * ['hosts', 'list']                           lists() → list()
 * ['hosts', 'pairing']                        pairings()
 * ['hosts', 'pairing', 'list']                pairingLists() → pairingList()   the tokens Add host polls
 * ['hosts', 'pairing', 'detail']              pairingDetails()
 * ['hosts', 'pairing', 'detail', name]        pairingDetail(name)              the token Add host shows
 * ```
 *
 * A pairing detail's `queryFn` mints: refetching it issues a new token under
 * the command on screen. So refresh the poll with `pairingLists()`, and never
 * invalidate `pairings()` or `pairingDetails()` while Add host is open.
 */
export const hostsKeys = {
  all: ['hosts'] as const,
  lists: () => [...hostsKeys.all, 'list'] as const,
  list: () => [...hostsKeys.lists()] as const,
  pairings: () => [...hostsKeys.all, 'pairing'] as const,
  pairingLists: () => [...hostsKeys.pairings(), 'list'] as const,
  pairingList: () => [...hostsKeys.pairingLists()] as const,
  pairingDetails: () => [...hostsKeys.pairings(), 'detail'] as const,
  pairingDetail: (name: string) => [...hostsKeys.pairingDetails(), name] as const,
};

/** The hosts the caller has paired: New session's host chip and the pairing surfaces. */
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
 * The token Add host is showing.
 *
 * A query rather than a mutation fired from an effect, even though minting
 * writes: the step needs exactly one token for as long as it is open, which is
 * what a query keyed to the screen gives — fetched once on mount, returned
 * from cache on a re-render, and replaced by `useReplacePairing` when the
 * reader asks for a new one. Minting from an effect needed a ref to survive
 * StrictMode and left the old command on screen until the next one resolved.
 *
 * Never cached beyond the visit: a token is single-use and hour-long, so
 * handing a second visit the first one's command would show a secret that no
 * longer pairs anything.
 */
export function useCurrentPairing(
  name: string,
  options?: Omit<UseQueryOptions<HostPairing, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: hostsKeys.pairingDetail(name),
    queryFn: () => app.hosts.pair(name),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    ...options,
  });
}

/**
 * Add host's "New token": mint a replacement for the token on screen and put
 * it where `useCurrentPairing(name)` reads it. The replaced token is revoked by
 * the same API write, so a refused mint (the cap, a network error) leaves the
 * one on screen spendable and unchanged.
 */
export function useReplacePairing(name: string) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (replaces: string | undefined) => app.hosts.pair(name, replaces),
    onSuccess: (pairing) => {
      queryClient.setQueryData(hostsKeys.pairingDetail(name), pairing);
    },
  });
}

/**
 * The caller's pairing tokens. Add host polls this to find out whether the
 * token it minted has been spent, and on which machine — a question the host
 * list cannot answer for an account that already owns one.
 */
export function usePairingTokens(
  options?: Omit<UseQueryOptions<HostPairingToken[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: hostsKeys.pairingList(),
    queryFn: () => app.hosts.pairings(),
    ...options,
  });
}

export function useRemoveHost(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.hosts.remove(id),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: hostsKeys.lists() });
    }),
  });
}
