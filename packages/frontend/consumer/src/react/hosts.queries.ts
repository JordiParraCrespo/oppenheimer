'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { HostEntity, HostPairing, HostPairingToken } from '../modules/hosts/host.entity';
import { useConsumerApp } from './context';
import { type Poll, type PollKeys, pollWhile } from './live-poll';

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

/**
 * The hosts the caller has paired: New session's host chip and the pairing surfaces.
 *
 * Pass `select` to subscribe to less than the whole list — one host's name, the
 * ids — so a refetch that changes nothing the reader shows does not re-render
 * it. A component that only needs the list inside an event handler should not
 * subscribe at all: that is `useHostsSnapshot`.
 */
export function useHosts<TData = HostEntity[]>(options?: HostListOptions<TData>) {
  return useHostList(options);
}

/**
 * The hosts, for a view that shows whether each is online. Presence is not
 * streamed to the console yet, so the list polls on `LIVE_POLL.hostPresence`
 * while `watching` holds: for as long as Settings → Hosts is mounted, and for
 * as long as a session's terminal is told its host is offline. `select` reads
 * less than the whole list, as on `useHosts`.
 */
export function useHostPresence<TData = HostEntity[]>({
  watching = true,
  select,
}: {
  watching?: boolean;
  select?: (hosts: HostEntity[]) => TData;
} = {}) {
  return useHostList<TData>(select ? { select } : undefined, pollWhile('hostPresence', watching));
}

type HostListOptions<TData> = Omit<
  UseQueryOptions<HostEntity[], Error, TData>,
  'queryKey' | 'queryFn' | PollKeys
>;

/**
 * The one read of `GET /v1/hosts`, polling as `poll` says. Not in the barrel:
 * a feature reads `useHosts`, which never polls, or `useHostPresence`, and the
 * pairing flow polls it on `LIVE_POLL.pairing`.
 */
export function useHostList<TData = HostEntity[]>(
  options?: HostListOptions<TData>,
  poll?: Poll<HostEntity[]>,
) {
  const app = useConsumerApp();

  return useQuery<HostEntity[], Error, TData>({
    queryKey: hostsKeys.list(),
    queryFn: () => app.hosts.findAll(),
    ...options,
    ...poll,
  });
}

/**
 * The hosts as the cache holds them right now, without subscribing to them.
 *
 * For a read that happens in an event handler — a project pick that checks its
 * default host is still paired — where `useHosts` would re-render the
 * component on every refetch for a value it never draws. `undefined` until
 * something on screen has read the list.
 */
export function useHostsSnapshot(): () => HostEntity[] | undefined {
  const queryClient = useQueryClient();
  return () => queryClient.getQueryData<HostEntity[]>(hostsKeys.list());
}

/**
 * The token Add host is showing.
 *
 * A query, though minting writes: the step needs exactly one token while it is
 * open, fetched once on mount and replaced by `useReplacePairing` on request.
 * Minting from an effect would need a ref to survive StrictMode and would
 * leave the old command on screen until the next one resolved.
 *
 * Never cached beyond the visit: a token is single-use and hour-long, so a
 * second visit must not show a secret that no longer pairs anything.
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
 * it where `useCurrentPairing(name)` reads it. A refused mint (the cap, a
 * network error) leaves the one on screen spendable and unchanged.
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
 * token it minted has been spent, and on which machine.
 */
export function usePairingTokens(
  options?: Omit<UseQueryOptions<HostPairingToken[], Error>, 'queryKey' | 'queryFn' | PollKeys>,
  poll?: Poll<HostPairingToken[]>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: hostsKeys.pairingList(),
    queryFn: () => app.hosts.pairings(),
    ...options,
    ...poll,
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

/**
 * The list is refreshed rather than patched: the row's status and counts come
 * back from the same read, so one source says what a host is.
 */
export function useRenameHost(
  options?: UseMutationOptions<HostEntity, Error, { id: string; name: string }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => app.hosts.rename(id, name),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: hostsKeys.lists() });
    }),
  });
}
