'use client';

import { useSuspenseQueries } from '@oppenheimer/frontend-core/react';
import { useQueryClient } from '@tanstack/react-query';
import type { SlackAccountEntity, SlackOwnerLink } from '../modules/slack';
import { useConsumerApp } from './context';
import { mutation } from './mutation';
import { slackKeys } from './slack.keys';

/**
 * A bot's Slack section: its app if it has one, and what creating one takes
 * (the events address and the manifest link), fetched side by side under a
 * Suspense `QueryState`. A server that keeps no Slack tokens answers the
 * setup with `SLACK_003`, which the section's error slot says in its own
 * words. `error` is the first refetch that failed over data already drawn.
 */
export function useSuspenseBotSlack(botId: string) {
  const app = useConsumerApp();
  const [accounts, setup] = useSuspenseQueries({
    queries: [
      { queryKey: slackKeys.accounts(), queryFn: () => app.slack.findAccounts() },
      { queryKey: slackKeys.setup(botId), queryFn: () => app.slack.findSetup(botId) },
    ],
  });
  return {
    account: accounts.data.find((account) => account.botId === botId) ?? null,
    setup: setup.data,
    error: accounts.error ?? setup.error,
  };
}

type ConnectSlackVariables = { botId: string; botToken: string; signingSecret: string };

/**
 * Connects a bot's Slack app, or hands it new credentials: the row the server
 * answered is written in. The token and secret are sent once and never cached.
 */
export const useConnectSlack = mutation<SlackAccountEntity, ConnectSlackVariables>({
  run: (app, { botId, botToken, signingSecret }) =>
    app.slack.connect(botId, botToken, signingSecret),
  update: (queryClient, connected) =>
    queryClient.setQueryData<SlackAccountEntity[]>(slackKeys.accounts(), (rows) => [
      ...(rows ?? []).filter((row) => row.botId !== connected.botId),
      connected,
    ]),
});

/** Disconnects a bot's app: the server forgets its token, and the bot stops answering in Slack. */
export const useDisconnectSlack = mutation<void, string>({
  run: (app, id) => app.slack.disconnect(id),
  invalidates: () => [slackKeys.accounts()],
});

/**
 * Makes the one-time code that records the reader as the app's owner. The code
 * is the answer, never cached; the app reads `ownerLinked` once they send it,
 * which the page picks up when asked again (`useRefreshSlack`).
 */
export const useOpenSlackOwnerLink = mutation<SlackOwnerLink, string>({
  run: (app, id) => app.slack.openOwnerLink(id),
});

/** Asks for the apps again: the reader sent the code in Slack and comes back to see it took. */
export function useRefreshSlack() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: slackKeys.accounts() });
}
