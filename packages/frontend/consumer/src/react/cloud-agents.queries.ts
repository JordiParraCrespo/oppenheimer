'use client';

import { useQuery, useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';
import {
  skipToken,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { CloudAgentModel, CloudAgentStatusEntity } from '../modules/cloud-agents';
import { useConsumerApp } from './context';

export const cloudAgentsKeys = {
  all: ['cloud-agents'] as const,
  status: () => [...cloudAgentsKeys.all, 'status'] as const,
  providers: () => [...cloudAgentsKeys.all, 'provider'] as const,
  provider: (provider: CloudAgentProviderId) => [...cloudAgentsKeys.providers(), provider] as const,
  models: (provider: CloudAgentProviderId) =>
    [...cloudAgentsKeys.provider(provider), 'models'] as const,
};

/**
 * Whether the reader can start a cloud session, and on which vendors
 * (`GET /cloud-agents/status`), under a Suspense `QueryState`: Settings →
 * Cloud agents.
 */
export function useSuspenseCloudAgentStatus() {
  const app = useConsumerApp();
  return useSuspenseQuery<CloudAgentStatusEntity, Error>({
    queryKey: cloudAgentsKeys.status(),
    queryFn: () => app.cloudAgents.status(),
  });
}

/**
 * Whether the reader can start a cloud session, for New session's pickers,
 * which draw their own loading and failure. The same read as
 * {@link useSuspenseCloudAgentStatus}.
 */
export function useCloudAgentStatus() {
  const app = useConsumerApp();
  return useQuery<CloudAgentStatusEntity, Error>({
    queryKey: cloudAgentsKeys.status(),
    queryFn: () => app.cloudAgents.status(),
  });
}

/**
 * The models a vendor offers, for the agent picker's Cursor tab; its own
 * default ("Auto") is not among them. Asked for only once the reader has a
 * key for the vendor.
 */
export function useCloudAgentModels(provider: CloudAgentProviderId, connected: boolean) {
  const app = useConsumerApp();
  return useQuery<CloudAgentModel[], Error>({
    queryKey: cloudAgentsKeys.models(provider),
    queryFn: connected ? () => app.cloudAgents.models(provider) : skipToken,
  });
}

interface ConnectVariables {
  provider: CloudAgentProviderId;
  apiKey: string;
}

/**
 * Connects a vendor with the reader's key. The answer is the status with it
 * connected, written as is; the vendor's lists are read again on the new key.
 */
export function useConnectCloudAgentProvider(
  options?: UseMutationOptions<CloudAgentStatusEntity, Error, ConnectVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: ConnectVariables) =>
      app.cloudAgents.connect(provider, apiKey),
    ...withCacheOnSuccess(options, (status) => {
      queryClient.setQueryData(cloudAgentsKeys.status(), status);
      return queryClient.invalidateQueries({ queryKey: cloudAgentsKeys.providers() });
    }),
  });
}

/** Forgets the reader's key for a vendor. Their cloud sessions stay listed, as last heard of. */
export function useDisconnectCloudAgentProvider(
  options?: UseMutationOptions<void, Error, CloudAgentProviderId>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: CloudAgentProviderId) => app.cloudAgents.disconnect(provider),
    ...withCacheOnSuccess(options, () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: cloudAgentsKeys.status() }),
        queryClient.invalidateQueries({ queryKey: cloudAgentsKeys.providers() }),
      ]),
    ),
  });
}
