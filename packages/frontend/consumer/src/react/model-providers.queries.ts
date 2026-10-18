'use client';

import { useQuery, useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { ModelProviderEntity } from '../modules/bots/bot.entity';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';

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

/** Stores a provider's key. The answer carries no key, so the list is read again for its hint. */
export function usePutModelProviderKey(
  options?: UseMutationOptions<void, Error, ModelProviderKeyVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: ModelProviderKeyVariables) =>
      app.bots.putModelProviderKey(provider, apiKey),
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: botsKeys.providers() }),
    ),
  });
}

/** Makes a provider, one with a key, the one new bots start on. */
export function useSetDefaultModelProvider(options?: UseMutationOptions<void, Error, BotProvider>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: BotProvider) => app.bots.setDefaultModelProvider(provider),
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: botsKeys.providers() }),
    ),
  });
}

/** Forgets a provider's key, and with it the default when it was the one. */
export function useRemoveModelProviderKey(options?: UseMutationOptions<void, Error, BotProvider>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: BotProvider) => app.bots.removeModelProviderKey(provider),
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: botsKeys.providers() }),
    ),
  });
}
