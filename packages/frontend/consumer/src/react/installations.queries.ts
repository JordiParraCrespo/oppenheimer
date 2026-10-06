'use client';

import { useQueries, useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
  BranchEntity,
  InstallationCallback,
  InstallationEntity,
  InstallationStart,
  RepositoryEntity,
} from '../modules/installations/installation.entity';
import type { RepositoryRef } from '../modules/installations/repository-key';
import { useConsumerApp } from './context';

/**
 * Repositories repeat the key ladder under an installation's `detail(id)`:
 *
 * ```
 * [..., 'detail', id, 'repositories']                              repositories(id)
 * [..., 'detail', id, 'repositories', 'list']                      repositoryLists(id) → repositoryList(id)
 * [..., 'detail', id, 'repositories', 'detail']                    repositoryDetails(id)
 * [..., 'detail', id, 'repositories', 'detail', repoId]            repositoryDetail(id, repoId)
 * [..., 'detail', id, 'repositories', 'detail', repoId, 'branches'] branches(id, repoId)
 * ```
 *
 * So removing an installation drops its whole subtree, while refreshing its
 * repository list leaves every repository's branches alone — the list leaf is
 * not a prefix of them. An id a picker has not chosen yet stays `undefined` in
 * the key; the hook gates the fetch with `skipToken`.
 */
export const installationsKeys = {
  all: ['installations'] as const,
  lists: () => [...installationsKeys.all, 'list'] as const,
  list: () => [...installationsKeys.lists()] as const,
  details: () => [...installationsKeys.all, 'detail'] as const,
  detail: (installationId: string | undefined) =>
    [...installationsKeys.details(), installationId] as const,
  repositories: (installationId: string | undefined) =>
    [...installationsKeys.detail(installationId), 'repositories'] as const,
  repositoryLists: (installationId: string | undefined) =>
    [...installationsKeys.repositories(installationId), 'list'] as const,
  repositoryList: (installationId: string | undefined) =>
    [...installationsKeys.repositoryLists(installationId)] as const,
  repositoryDetails: (installationId: string | undefined) =>
    [...installationsKeys.repositories(installationId), 'detail'] as const,
  repositoryDetail: (installationId: string | undefined, githubRepoId: number | undefined) =>
    [...installationsKeys.repositoryDetails(installationId), githubRepoId] as const,
  branches: (installationId: string | undefined, githubRepoId: number | undefined) =>
    [...installationsKeys.repositoryDetail(installationId, githubRepoId), 'branches'] as const,
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

/** What the connect step posts: the three values GitHub puts on its install redirect. */
export type ConnectInstallationVariables = InstallationCallback;

/**
 * Start a GitHub App install. A mutation, fired from a click, because every
 * call is a write — minting on render would put one in Redis for every paint
 * of a button nobody pressed. Nothing is cached: the state is spent on the way
 * back.
 */
export function useStartInstallation(options?: UseMutationOptions<InstallationStart, Error, void>) {
  const app = useConsumerApp();

  return useMutation({
    ...options,
    mutationFn: () => app.installations.startInstall(),
  });
}

/**
 * "Manage repository access": open the GitHub App's install page in a new tab
 * with a minted install state (`POST /installations` refuses a callback
 * without one). It is how a workspace reaches an organization's repositories:
 * the App is installed on that organization, or an owner is asked to.
 *
 * Minted on click, not render: every mint is a Redis key and the pickers that
 * offer this render on every dialog. The tab opens **before** the mint, in the
 * click, because popup blockers refuse a `window.open` after an `await`; it
 * starts blank with `opener` cut and is pointed at GitHub once the URL
 * arrives. A failed mint closes it and leaves the error to the caller.
 */
export function useManageGithubAccess() {
  const { mutate, error, reset } = useStartInstallation();

  return {
    manage: () => {
      const tab = window.open('', '_blank');
      if (tab) tab.opener = null;
      mutate(undefined, {
        onSuccess: ({ url }) => {
          // A blocked popup leaves nowhere to send the reader but here.
          if (tab) tab.location.href = url;
          else window.location.assign(url);
        },
        onError: () => tab?.close(),
      });
    },
    /** Why the last mint failed, until `dismiss`. */
    error,
    dismiss: reset,
  };
}

/**
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
    mutationFn: (callback: ConnectInstallationVariables) => app.installations.connect(callback),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: installationsKeys.lists() });
    }),
  });
}

/** The repositories one installation can reach: the picker, and the Ready summary's count. */
export function useInstallationRepositories(
  installationId: string | undefined,
  options?: Omit<UseQueryOptions<RepositoryEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: installationsKeys.repositoryList(installationId),
    queryFn: installationId ? () => app.installations.repositories(installationId) : skipToken,
    ...options,
  });
}

/**
 * The branches of several repositories at once; a one-repository picker passes
 * a one-element array. `useQueries` because the selection's length changes.
 *
 * `combine` is keyed on which repositories are asked for, not on the array
 * that names them: callers build that array in render, an inline `combine`
 * re-runs each time, and the `Map` it returns cannot be structurally shared, so
 * every memo keyed on `byRepository` would miss. (A plain array is shared, which
 * is why `useInstallationRepositoriesFor` needs none of this.)
 */
export function useRepositoryBranchesFor(repositories: readonly RepositoryRef[]) {
  const app = useConsumerApp();
  const asked = repositories.map((repository) => repository.githubRepoId).join(',');

  const combine = useCallback(
    (results: UseQueryResult<BranchEntity[]>[]) => {
      const ids = asked ? asked.split(',').map(Number) : [];
      return {
        /** Branches by `githubRepoId`, holding only the repositories that answered. */
        byRepository: new Map(
          results.flatMap((result, index) => {
            const id = ids[index];
            return result.data && id !== undefined
              ? ([[id, result.data]] as [number, BranchEntity[]][])
              : [];
          }),
        ),
        isPending: results.some((result) => result.isPending),
      };
    },
    [asked],
  );

  return useQueries({
    queries: repositories.map((repository) => ({
      queryKey: installationsKeys.branches(repository.installationId, repository.githubRepoId),
      queryFn: () => app.installations.branches(repository.installationId, repository.githubRepoId),
    })),
    combine,
  });
}

/**
 * A workspace may have the App installed on more than one account — a personal
 * one and an organisation's — and the picker is one list rather than one per
 * account. Each row carries the installation it came from: a repository is
 * named by the pair (`repository-key.ts`).
 */
export function useInstallationRepositoriesFor(installationIds: readonly string[]) {
  const app = useConsumerApp();

  return useQueries({
    queries: installationIds.map((installationId) => ({
      queryKey: installationsKeys.repositoryList(installationId),
      queryFn: () => app.installations.repositories(installationId),
    })),
    combine: (results) => ({
      repositories: results.flatMap((result, index) => {
        const installationId = installationIds[index];
        if (!result.data || !installationId) return [];
        return result.data.map((repository) => ({ repository, installationId }));
      }),
      isPending: results.some((result) => result.isPending),
      // The first failure, so a picker can say the list did not load rather
      // than show the repositories that did as if they were all of them.
      error: results.find((result) => result.error)?.error ?? null,
    }),
  });
}
