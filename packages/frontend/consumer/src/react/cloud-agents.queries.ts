'use client';

import { useQuery, useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type {
  CloudAgentProviderId,
  LaunchCloudAgentDto,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CloudAgentEntity,
  CloudAgentModel,
  CloudAgentStatusEntity,
} from '../modules/cloud-agents';
import { useConsumerApp } from './context';
import { usePollWhile } from './live-poll';

export const cloudAgentsKeys = {
  all: ['cloud-agents'] as const,
  status: () => [...cloudAgentsKeys.all, 'status'] as const,
  lists: () => [...cloudAgentsKeys.all, 'list'] as const,
  list: () => [...cloudAgentsKeys.lists()] as const,
  details: () => [...cloudAgentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...cloudAgentsKeys.details(), id] as const,
  providers: () => [...cloudAgentsKeys.all, 'provider'] as const,
  provider: (provider: CloudAgentProviderId) => [...cloudAgentsKeys.providers(), provider] as const,
  models: (provider: CloudAgentProviderId) =>
    [...cloudAgentsKeys.provider(provider), 'models'] as const,
  repositories: (provider: CloudAgentProviderId) =>
    [...cloudAgentsKeys.provider(provider), 'repositories'] as const,
};

/**
 * Whether the reader can launch a cloud agent, and on which vendors
 * (`GET /cloud-agents/status`), under a Suspense `QueryState`: Settings →
 * Cloud agents and the launch page.
 */
export function useSuspenseCloudAgentStatus() {
  const app = useConsumerApp();
  return useSuspenseQuery<CloudAgentStatusEntity, Error>({
    queryKey: cloudAgentsKeys.status(),
    queryFn: () => app.cloudAgents.status(),
  });
}

/**
 * The reader's cloud agents, newest first, under a Suspense `QueryState`.
 * It polls while one of them is working; the API asks the vendor about a
 * few at a time, so a list kept open moves on its own.
 */
export function useSuspenseCloudAgents() {
  const app = useConsumerApp();
  return useSuspenseQuery<CloudAgentEntity[], Error>({
    queryKey: cloudAgentsKeys.list(),
    queryFn: () => app.cloudAgents.findAll(),
    ...usePollWhile<CloudAgentEntity[]>(
      'cloudAgent',
      cloudAgentsKeys.list(),
      (rows) => rows?.some((agent) => agent.isActive) ?? false,
    ),
  });
}

/** One of the reader's cloud agents under a Suspense `QueryState`, polling while it works. */
export function useSuspenseCloudAgent(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<CloudAgentEntity, Error>({
    queryKey: cloudAgentsKeys.detail(id),
    queryFn: () => app.cloudAgents.findOne(id),
    ...usePollWhile<CloudAgentEntity>(
      'cloudAgent',
      cloudAgentsKeys.detail(id),
      (agent) => agent?.isActive ?? false,
    ),
  });
}

/** The models a vendor offers, for the launch form's picker; its own default is not among them. */
export function useCloudAgentModels(provider: CloudAgentProviderId) {
  const app = useConsumerApp();
  return useQuery<CloudAgentModel[], Error>({
    queryKey: cloudAgentsKeys.models(provider),
    queryFn: () => app.cloudAgents.models(provider),
  });
}

/** The repositories a vendor can reach for the reader, for the launch form's picker. */
export function useCloudAgentRepositories(provider: CloudAgentProviderId) {
  const app = useConsumerApp();
  return useQuery<string[], Error>({
    queryKey: cloudAgentsKeys.repositories(provider),
    queryFn: () => app.cloudAgents.repositories(provider),
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

/** Forgets the reader's key for a vendor. Their agents stay listed, as last heard of. */
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

/** Writes an agent a mutation answered with: its detail as is, and the list read again. */
function useStoreAgent() {
  const queryClient = useQueryClient();
  return (agent: CloudAgentEntity) => {
    queryClient.setQueryData(cloudAgentsKeys.detail(agent.id), agent);
    return queryClient.invalidateQueries({ queryKey: cloudAgentsKeys.lists() });
  };
}

/** Launches a cloud agent; the answer is the agent, starting. */
export function useLaunchCloudAgent(
  options?: UseMutationOptions<CloudAgentEntity, Error, LaunchCloudAgentDto>,
) {
  const app = useConsumerApp();
  const store = useStoreAgent();
  return useMutation({
    mutationFn: (input: LaunchCloudAgentDto) => app.cloudAgents.launch(input),
    ...withCacheOnSuccess(options, store),
  });
}

/** Gives an agent its next instruction, as a new run. */
export function useFollowUpCloudAgent(
  id: string,
  options?: UseMutationOptions<CloudAgentEntity, Error, string>,
) {
  const app = useConsumerApp();
  const store = useStoreAgent();
  return useMutation({
    mutationFn: (prompt: string) => app.cloudAgents.followUp(id, prompt),
    ...withCacheOnSuccess(options, store),
  });
}

/** Stops an agent's latest run. */
export function useCancelCloudAgent(
  id: string,
  options?: UseMutationOptions<CloudAgentEntity, Error, void>,
) {
  const app = useConsumerApp();
  const store = useStoreAgent();
  return useMutation({
    mutationFn: () => app.cloudAgents.cancel(id),
    ...withCacheOnSuccess(options, store),
  });
}
