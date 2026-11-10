'use client';

import { useSuspenseQueries, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WhatsappAccountEntity } from '../modules/whatsapp';
import { useBotListQuery } from './bots.queries';
import { useConsumerApp } from './context';
import { useHostListQuery } from './hosts.queries';
import { usePollWhile } from './live-poll';

const whatsappKeys = {
  all: ['whatsapp'] as const,
  accounts: () => [...whatsappKeys.all, 'accounts'] as const,
};

/**
 * The reader's own WhatsApp numbers, oldest first, the hosts that can hold
 * one, and their Oppenheimer bots, fetched side by side under a Suspense
 * `QueryState`: Settings → WhatsApp names each number's host, offers the
 * hosts to link on, and the bots that can answer there. While a
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
  const [accounts, hosts, bots] = useSuspenseQueries({
    queries: [
      {
        queryKey: whatsappKeys.accounts(),
        queryFn: () => app.whatsapp.findAccounts(),
        ...poll,
      },
      useHostListQuery(),
      useBotListQuery(),
    ],
  });
  return {
    accounts: accounts.data,
    hosts: hosts.data,
    bots: bots.data,
    error: accounts.error ?? hosts.error ?? bots.error,
  };
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

/** Writes the row the server answered over the one in the list. */
function useWriteWhatsappRow() {
  const queryClient = useQueryClient();
  return (updated: WhatsappAccountEntity) =>
    queryClient.setQueryData<WhatsappAccountEntity[]>(whatsappKeys.accounts(), (rows) =>
      rows?.map((row) => (row.id === updated.id ? updated : row)),
    );
}

type AnswerWhatsappAsVariables = { id: string; answeringBotId: string | null };

/** Chooses which of the reader's bots answers them on a number by default, or none; the row is written in. */
export function useAnswerWhatsappAs(
  options?: UseMutationOptions<WhatsappAccountEntity, Error, AnswerWhatsappAsVariables>,
) {
  const app = useConsumerApp();
  const write = useWriteWhatsappRow();
  return useMutation({
    mutationFn: ({ id, answeringBotId }: AnswerWhatsappAsVariables) =>
      app.whatsapp.answerAs(id, answeringBotId),
    ...withCacheOnSuccess(options, write),
  });
}

type RequestWhatsappOwnerVariables = { id: string; phone: string };

/**
 * Sends a code to the reader's own number from one of theirs: the row comes
 * back with the number and when the code expires, and is written in, so the
 * screen turns to entering the code. The code itself is never in the cache.
 */
export function useRequestWhatsappOwner(
  options?: UseMutationOptions<WhatsappAccountEntity, Error, RequestWhatsappOwnerVariables>,
) {
  const app = useConsumerApp();
  const write = useWriteWhatsappRow();
  return useMutation({
    mutationFn: ({ id, phone }: RequestWhatsappOwnerVariables) =>
      app.whatsapp.requestOwner(id, phone),
    ...withCacheOnSuccess(options, write),
  });
}

type ConfirmWhatsappOwnerVariables = { id: string; code: string };

/** Enters the code the reader's number received: the row comes back with that number confirmed. */
export function useConfirmWhatsappOwner(
  options?: UseMutationOptions<WhatsappAccountEntity, Error, ConfirmWhatsappOwnerVariables>,
) {
  const app = useConsumerApp();
  const write = useWriteWhatsappRow();
  return useMutation({
    mutationFn: ({ id, code }: ConfirmWhatsappOwnerVariables) =>
      app.whatsapp.confirmOwner(id, code),
    ...withCacheOnSuccess(options, write),
  });
}
