'use client';

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  InstallationEntity,
  RepositoryEntity,
} from '../modules/installations/installation.entity';
import { useConsumerApp } from './context';

/**
 * Query key factory for the `installations` feature, from the most generic
 * (`all`) to the most specific so a whole subtree can be invalidated at once.
 */
export const installationsKeys = {
  all: ['installations'] as const,
  lists: () => [...installationsKeys.all, 'list'] as const,
  list: () => [...installationsKeys.lists()] as const,
  repositories: (installationId: string) =>
    [...installationsKeys.all, installationId, 'repositories'] as const,
};

/**
 * The GitHub App installations this workspace has connected.
 *
 * An empty list means "not connected yet", which is a real answer the
 * onboarding step renders. It never means "this deployment has no App" — that
 * is the `github_app` capability, and the two are read separately so a missing
 * App cannot be mistaken for a reader who has not installed one.
 */
export function useInstallations(
  options?: Omit<UseQueryOptions<InstallationEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: installationsKeys.list(),
    queryFn: () => app.installations.findAll(),
    ...options,
  });
}

/** What the connect step posts: the two values GitHub puts on its install redirect. */
export interface ConnectInstallationVariables {
  githubInstallationId: number;
  code: string;
}

/**
 * Attach the installation GitHub just created to this workspace.
 *
 * The list is invalidated on success because the step that called this renders
 * straight off it — without that, a reader who has just connected is told they
 * have not.
 */
export function useConnectInstallation(
  options?: UseMutationOptions<InstallationEntity, Error, ConnectInstallationVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ githubInstallationId, code }: ConnectInstallationVariables) =>
      app.installations.connect(githubInstallationId, code),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: installationsKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useRemoveInstallation(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.installations.remove(id),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: installationsKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}

/** The repositories one installation can reach: the picker, and the Ready summary's count. */
export function useInstallationRepositories(
  installationId: string | undefined,
  options?: Omit<UseQueryOptions<RepositoryEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: installationsKeys.repositories(installationId ?? ''),
    queryFn: () => app.installations.repositories(installationId as string),
    enabled: Boolean(installationId),
    ...options,
  });
}
