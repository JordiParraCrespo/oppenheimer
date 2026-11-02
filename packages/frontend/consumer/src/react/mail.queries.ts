'use client';

import { useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import type { GmailConnectionEntity, ScheduledMailEntity } from '../modules/mail';
import { useConsumerApp } from './context';
import { mailKeys } from './mail.keys';
import { mutation } from './mutation';

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
export const useStartGmailConnection = mutation<string, string | undefined>({
  run: (app, connectionId) => app.mail.startConnection(connectionId),
  update: (_queryClient, url) => {
    window.location.assign(url);
  },
});

/** Hands Google's redirect to the API: the account it names is added, or reconnected in place. */
export const useConnectGmail = mutation<GmailConnectionEntity, { code: string; state: string }>({
  run: (app, { code, state }) => app.mail.connect(code, state),
  update: (queryClient) => queryClient.invalidateQueries({ queryKey: mailKeys.connections() }),
});

/** Renames one account; the row the server answered is written in place. */
export const useRenameGmailConnection = mutation<
  GmailConnectionEntity,
  { id: string; label: string }
>({
  run: (app, { id, label }) => app.mail.rename(id, label),
  update: (queryClient, renamed) => {
    queryClient.setQueryData<GmailConnectionEntity[]>(mailKeys.connections(), (rows) =>
      rows?.map((row) => (row.id === renamed.id ? renamed : row)),
    );
  },
});

/** Disconnects one account: its grant is revoked at Google and no bot reaches it again. */
export const useDisconnectGmail = mutation<void, string>({
  run: (app, id) => app.mail.disconnect(id),
  update: (queryClient) => queryClient.invalidateQueries({ queryKey: mailKeys.connections() }),
});

/** The mail the reader's bots scheduled, still waiting, soonest first, under a Suspense `QueryState`. */
export function useSuspenseScheduledMail() {
  const app = useConsumerApp();
  return useSuspenseQuery<ScheduledMailEntity[], Error>({
    queryKey: mailKeys.scheduled(),
    queryFn: () => app.mail.findScheduled(),
  });
}

/** Cancels one scheduled send; it leaves the list, and the list is read again. */
export const useCancelScheduledMail = mutation<void, string>({
  run: (app, id) => app.mail.cancelScheduled(id),
  update: (queryClient, _result, id) => {
    queryClient.setQueryData<ScheduledMailEntity[]>(mailKeys.scheduled(), (rows) =>
      rows?.filter((row) => row.id !== id),
    );
    return queryClient.invalidateQueries({ queryKey: mailKeys.scheduled() });
  },
});
