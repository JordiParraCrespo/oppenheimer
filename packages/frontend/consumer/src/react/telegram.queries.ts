'use client';

import { useSuspenseQueries, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TelegramAccountEntity } from '../modules/telegram';
import { useConsumerApp } from './context';
import { useHostListQuery } from './hosts.queries';
import { usePollWhile } from './live-poll';

const telegramKeys = {
  all: ['telegram'] as const,
  accounts: () => [...telegramKeys.all, 'accounts'] as const,
};

/**
 * The reader's own Telegram bots, oldest first, and the hosts that can hold
 * one, fetched side by side under a Suspense `QueryState`: Settings → Telegram
 * names each bot's host and offers the hosts to connect on. While a bot is
 * connecting the bots are asked again on `LIVE_POLL.telegramConnecting`, so
 * the row turns connected (or revoked, with Telegram's reason) once the host
 * has checked the token. `error` is the first refetch that failed over data
 * already drawn.
 */
export function useSuspenseTelegramSettings() {
  const app = useConsumerApp();
  const poll = usePollWhile<TelegramAccountEntity[]>(
    'telegramConnecting',
    telegramKeys.accounts(),
    (rows) => rows?.some((row) => row.isConnecting) ?? false,
  );
  const [accounts, hosts] = useSuspenseQueries({
    queries: [
      {
        queryKey: telegramKeys.accounts(),
        queryFn: () => app.telegram.findAccounts(),
        ...poll,
      },
      useHostListQuery(),
    ],
  });
  return { accounts: accounts.data, hosts: hosts.data, error: accounts.error ?? hosts.error };
}

type LinkTelegramVariables = { hostId: string; token: string; label?: string };

/**
 * Connects a bot on one of the reader's hosts, or hands the one there a new
 * token: the row the server answered is written in, and the list polls while
 * it connects. The token is sent once and never kept in the cache.
 */
export function useLinkTelegram(
  options?: UseMutationOptions<TelegramAccountEntity, Error, LinkTelegramVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hostId, token, label }: LinkTelegramVariables) =>
      app.telegram.link(hostId, token, label),
    ...withCacheOnSuccess(options, (linked) => {
      queryClient.setQueryData<TelegramAccountEntity[]>(telegramKeys.accounts(), (rows) =>
        rows?.some((row) => row.id === linked.id)
          ? rows.map((row) => (row.id === linked.id ? linked : row))
          : [...(rows ?? []), linked],
      );
    }),
  });
}

/** Disconnects one bot: the host forgets its token and no bot of the reader's reaches it again. */
export function useUnlinkTelegram(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.telegram.unlink(id),
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: telegramKeys.accounts() }),
    ),
  });
}
