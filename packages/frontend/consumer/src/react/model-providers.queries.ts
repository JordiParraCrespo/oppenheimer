'use client';

import { useQuery, useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
import { type QueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { ModelProviderEntity } from '../modules/bots/bot.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';
import { voiceKeys } from './voice.keys';

/**
 * The workspace's model providers (Settings → Model providers): which have a
 * key, which one new bots start on, and the mutations that change either.
 * Every write reads the list again: an answer carries no key, and one change
 * of key or default can move the resolved default to another row.
 */

function useModelProviderListQuery() {
  const app = useConsumerApp();
  return { queryKey: botsKeys.providerList(), queryFn: () => app.bots.findModelProviders() };
}

/** The model providers, for a reader that draws nothing while they load (the composer). */
export function useModelProviders<TData = ModelProviderEntity[]>(
  options?: Omit<UseQueryOptions<ModelProviderEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ModelProviderEntity[], Error, TData>({
    ...useModelProviderListQuery(),
    ...options,
  });
}

/** The workspace's model providers, each with whether it has a key, under a Suspense `QueryState`. */
export function useSuspenseModelProviders() {
  return useSuspenseQuery<ModelProviderEntity[], Error>(useModelProviderListQuery());
}

interface ModelProviderKeyVariables {
  provider: BotProvider;
  apiKey: string;
}

/**
 * Re-reads what a workspace's model providers decide: the provider list, and
 * whether it can dictate (a ChatGPT sign-in is a speech provider). Every
 * change to a sign-in or a key goes through here.
 */
export function invalidateModelProviders(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: botsKeys.providers() }),
    queryClient.invalidateQueries({ queryKey: voiceKeys.all }),
  ]);
}

/** Stores a provider's key. The answer carries no key, so the list is read again for its hint. */
export const usePutModelProviderKey = mutation<void, ModelProviderKeyVariables>({
  run: (app, { provider, apiKey }) => app.bots.putModelProviderKey(provider, apiKey),
  update: (queryClient) => invalidateModelProviders(queryClient),
});

/** Makes a provider, one with a key, the one new bots start on. */
export const useSetDefaultModelProvider = mutation<void, BotProvider>({
  run: (app, provider) => app.bots.setDefaultModelProvider(provider),
  update: (queryClient) => queryClient.invalidateQueries({ queryKey: botsKeys.providers() }),
});

/** Forgets a provider's key, and with it the default when it was the one. */
export const useRemoveModelProviderKey = mutation<void, BotProvider>({
  run: (app, provider) => app.bots.removeModelProviderKey(provider),
  update: (queryClient) => invalidateModelProviders(queryClient),
});
