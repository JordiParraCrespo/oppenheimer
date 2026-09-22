'use client';

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { HostEntity, HostPairing, HostPairingToken } from '../modules/hosts/host.entity';
import { useConsumerApp } from './context';

/**
 * Query key factory for the `hosts` feature, from the most generic (`all`) to
 * the most specific so a whole subtree can be invalidated with one key.
 */
export const hostsKeys = {
  all: ['hosts'] as const,
  lists: () => [...hostsKeys.all, 'list'] as const,
  list: () => [...hostsKeys.lists()] as const,
  pairings: () => [...hostsKeys.all, 'pairings'] as const,
  currentPairing: (name: string) => [...hostsKeys.all, 'pairing', 'current', name] as const,
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
export function usePairHost(options?: UseMutationOptions<HostPairing, Error, string>) {
  const app = useConsumerApp();

  return useMutation({
    mutationFn: (name: string) => app.hosts.pair(name),
    ...options,
  });
}

/**
 * The token Add host is showing.
 *
 * A query rather than a mutation fired from an effect, even though minting
 * writes: the step needs exactly one token for as long as it is open, which is
 * what a query keyed to the screen gives — fetched once on mount, returned
 * from cache on a re-render, and replaced by `refetch()` when the reader asks
 * for a new one. Minting from an effect needed a ref to survive StrictMode and
 * left the old command on screen until the next one resolved.
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
    queryKey: hostsKeys.currentPairing(name),
    queryFn: () => app.hosts.pair(name),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    ...options,
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
    queryKey: hostsKeys.pairings(),
    queryFn: () => app.hosts.pairings(),
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

/** How often a pairing surface asks whether its token has been spent yet. */
const PAIRING_POLL_MS = 3000;

/**
 * The pairing token an Add host surface is showing, its clock, and the host
 * **this token** paired.
 *
 * Here rather than in one app's feature because two surfaces run the same
 * flow: the onboarding step (`apps/web/src/features/hosts/screens/`) and the
 * console's Add host dialog (`.../features/sessions/dialogs/`). It is the
 * product's, not the web app's — nothing in it touches the DOM or a router.
 *
 * One token is minted per visit. The mint is a query, not a mutation fired
 * from an effect — a surface needs exactly one token for as long as it is open,
 * which is what a query keyed to it gives, and `regenerate()` is its refetch.
 * Nothing here has to survive StrictMode by hand.
 *
 * Correlation is the point. "The host list is non-empty" is a different
 * question from "this token landed" — an account that already owns a machine
 * answers the first the moment the dialog opens, which would enable Use this
 * host under a command nobody has run. So the poll watches the *token*: the
 * pairing list reports `redeemedHostId` once a runner spends it, and only then
 * is the matching host looked up.
 *
 * One effect, and it synchronises with the clock. The countdown is recomputed
 * from `expiresAt` rather than decremented, so a backgrounded tab that missed
 * a hundred ticks still shows the right number when it comes back.
 */
export function useHostPairing(hostName: string) {
  const { data: pairing, isPending, error, refetch } = useCurrentPairing(hostName);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pairing) return;

    const remaining = () =>
      Math.max(0, Math.floor((pairing.expiresAt.getTime() - Date.now()) / 1000));

    setSeconds(remaining());
    const tick = setInterval(() => setSeconds(remaining()), 1000);
    return () => clearInterval(tick);
  }, [pairing]);

  const expired = Boolean(pairing) && seconds <= 0;

  // Poll the token, not the host list. Stops once this token names a host, and
  // once it has expired: a dead token can pair nothing, so polling past that is
  // a request every three seconds that can only answer "no".
  const { data: tokens } = usePairingTokens({
    enabled: Boolean(pairing) && !expired,
    refetchInterval: (query) => {
      if (!pairing || expired) return false;
      const mine = query.state.data?.find((token) => token.id === pairing.id);
      return mine?.redeemedHostId ? false : PAIRING_POLL_MS;
    },
  });

  const redeemedHostId = tokens?.find((token) => token.id === pairing?.id)?.redeemedHostId ?? null;

  // The host row appears when the runner registers; its service may still be
  // starting, so the caller decides what `online` means for its primary action.
  const { data: hosts } = useHosts({
    enabled: Boolean(redeemedHostId),
    refetchInterval: (query) => {
      if (!redeemedHostId) return false;
      const host = query.state.data?.find((row) => row.id === redeemedHostId);
      return host?.online ? false : PAIRING_POLL_MS;
    },
  });

  const host: HostEntity | null = redeemedHostId
    ? (hosts?.find((row) => row.id === redeemedHostId) ?? null)
    : null;

  const minutes = Math.floor(seconds / 60);
  const countdown = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;

  return {
    pairing,
    countdown,
    /** Whether the token has run out, so the surface can offer a new one. */
    expired,
    host,
    isPending,
    error,
    /** Replace the token on screen with a fresh one. */
    regenerate: () => refetch(),
  };
}
