'use client';

import { useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GmailConnectionEntity, ScheduledMailEntity } from '../modules/mail';
import { useConsumerApp } from './context';
import { mailKeys } from './mail.keys';

/** The reader's own Gmail accounts, oldest first, under a Suspense `QueryState`: Settings → Mail. */
export function useSuspenseGmailConnections() {
  const app = useConsumerApp();
  return useSuspenseQuery<GmailConnectionEntity[], Error>({
    queryKey: mailKeys.connections(),
    queryFn: () => app.mail.findConnections(),
  });
}

/**
 * Asks for Google's consent page and sends the browser there: a new account,
 * or, given a connection's id, a reconnect of that one.
 */
export function useStartGmailConnection(
  options?: UseMutationOptions<string, Error, string | undefined>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (connectionId?: string) => app.mail.startConnection(connectionId),
    ...withCacheOnSuccess(options, (url) => {
      window.location.assign(url);
    }),
  });
}

/** Hands Google's redirect to the API: the account it names is added, or reconnected in place. */
export function useConnectGmail(
  options?: UseMutationOptions<GmailConnectionEntity, Error, { code: string; state: string }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) => app.mail.connect(code, state),
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: mailKeys.connections() }),
    ),
  });
}

/** Renames one account; the row the server answered is written in place. */
export function useRenameGmailConnection(
  options?: UseMutationOptions<GmailConnectionEntity, Error, { id: string; label: string }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => app.mail.rename(id, label),
    ...withCacheOnSuccess(options, (renamed) => {
      queryClient.setQueryData<GmailConnectionEntity[]>(mailKeys.connections(), (rows) =>
        rows?.map((row) => (row.id === renamed.id ? renamed : row)),
      );
    }),
  });
}

/** Disconnects one account: its grant is revoked at Google and no bot reaches it again. */
export function useDisconnectGmail(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.mail.disconnect(id),
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: mailKeys.connections() }),
    ),
  });
}

/** The mail the reader's bots scheduled, still waiting, soonest first, under a Suspense `QueryState`. */
export function useSuspenseScheduledMail() {
  const app = useConsumerApp();
  return useSuspenseQuery<ScheduledMailEntity[], Error>({
    queryKey: mailKeys.scheduled(),
    queryFn: () => app.mail.findScheduled(),
  });
}

/** Cancels one scheduled send; it leaves the list, and the list is read again. */
export function useCancelScheduledMail(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.mail.cancelScheduled(id),
    ...withCacheOnSuccess(options, (_result, id) => {
      queryClient.setQueryData<ScheduledMailEntity[]>(mailKeys.scheduled(), (rows) =>
        rows?.filter((row) => row.id !== id),
      );
      return queryClient.invalidateQueries({ queryKey: mailKeys.scheduled() });
    }),
  });
}
