'use client';

import { useSuspenseQueries, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WhatsappAccountEntity } from '../modules/whatsapp';
import { useConsumerApp } from './context';
import { useHostListQuery } from './hosts.queries';
import { usePollWhile } from './live-poll';

const whatsappKeys = {
  all: ['whatsapp'] as const,
  accounts: () => [...whatsappKeys.all, 'accounts'] as const,
};

/**
 * The reader's own WhatsApp numbers, oldest first, and the hosts that can
 * hold one, fetched side by side under a Suspense `QueryState`: Settings →
 * WhatsApp names each number's host and offers the hosts to link on. While a
 * number is pairing the numbers are asked again on `LIVE_POLL.whatsappPairing`,
 * so each QR code the host issues is drawn in turn and the row turns connected
 * once the phone scans one. `error` is the first refetch that failed over
 * data already drawn.
 */
export function useSuspenseWhatsappSettings() {
  const app = useConsumerApp();
  const poll = usePollWhile<WhatsappAccountEntity[]>(
    'whatsappPairing',
    whatsappKeys.accounts(),
    (rows) => rows?.some((row) => row.isPairing) ?? false,
  );
  const [accounts, hosts] = useSuspenseQueries({
    queries: [
      {
        queryKey: whatsappKeys.accounts(),
        queryFn: () => app.whatsapp.findAccounts(),
        ...poll,
      },
      useHostListQuery(),
    ],
  });
  return { accounts: accounts.data, hosts: hosts.data, error: accounts.error ?? hosts.error };
}

/**
 * Links a number on one of the reader's hosts, or pairs the one there again:
 * the row the server answered is written in, and the list polls while it pairs.
 */
export function useLinkWhatsapp(
  options?: UseMutationOptions<WhatsappAccountEntity, Error, { hostId: string; label?: string }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hostId, label }: { hostId: string; label?: string }) =>
      app.whatsapp.link(hostId, label),
    ...withCacheOnSuccess(options, (linked) => {
      queryClient.setQueryData<WhatsappAccountEntity[]>(whatsappKeys.accounts(), (rows) =>
        rows?.some((row) => row.id === linked.id)
          ? rows.map((row) => (row.id === linked.id ? linked : row))
          : [...(rows ?? []), linked],
      );
    }),
  });
}

/** Unlinks one number: the host logs its device out and no bot reaches it again. */
export function useUnlinkWhatsapp(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.whatsapp.unlink(id),
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: whatsappKeys.accounts() }),
    ),
  });
}
