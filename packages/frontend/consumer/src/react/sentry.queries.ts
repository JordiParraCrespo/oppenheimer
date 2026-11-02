'use client';

import { useQuery, useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import type { PutSentryConnectionDto } from '@oppenheimer/shared/schemas/sentry';
import type { SentryStatus } from '../modules/sentry';
import { useConsumerApp } from './context';
import { mutation } from './mutation';
import { sentryKeys } from './sentry.keys';

/** Whether Sentry is connected (`GET /sentry/connection`), under a Suspense `QueryState`: Settings → Sentry. */
export function useSuspenseSentryStatus() {
  const app = useConsumerApp();
  return useSuspenseQuery<SentryStatus, Error>({
    queryKey: sentryKeys.status(),
    queryFn: () => app.sentry.status(),
  });
}

/** The same read for the automation editor's Add trigger menu, which draws no loading of its own. */
export function useSentryStatus() {
  const app = useConsumerApp();
  return useQuery<SentryStatus, Error>({
    queryKey: sentryKeys.status(),
    queryFn: () => app.sentry.status(),
  });
}

/** Connects (or replaces) the workspace's Sentry organization; the answer is written as is. */
export const useConnectSentry = mutation<SentryStatus, PutSentryConnectionDto>({
  run: (app, body) => app.sentry.connect(body),
  update: (queryClient, status) => {
    queryClient.setQueryData(sentryKeys.status(), status);
  },
});

/** Forgets the workspace's Sentry organization; its triggers stop firing. */
export const useDisconnectSentry = mutation<void, void>({
  run: (app) => app.sentry.disconnect(),
  update: (queryClient) => queryClient.invalidateQueries({ queryKey: sentryKeys.status() }),
});
