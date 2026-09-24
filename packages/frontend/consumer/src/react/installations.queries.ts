'use client';

import { withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  BranchEntity,
  InstallationEntity,
  RepositoryEntity,
} from '../modules/installations/installation.entity';
import { useConsumerApp } from './context';

/**
 * Query key factory for the `installations` feature, from the most generic
 * (`all`) to the most specific so a whole subtree can be invalidated at once.
 *
 * What GitHub says about one installation hangs off its `detail(id)`, and
 * repositories repeat the ladder one level down, one function per level:
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
 * not a prefix of them.
 *
 * An id a picker has not chosen yet stays `undefined` in the key; the hook
 * gates the fetch with `skipToken` rather than inventing an id.
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
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: installationsKeys.lists() });
    }),
  });
}

export function useRemoveInstallation(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.installations.remove(id),
    ...withCacheOnSuccess(options, (_, id) => {
      queryClient.removeQueries({ queryKey: installationsKeys.detail(id) });
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
 * One repository's branches: the branch pane of New session's repository chip.
 *
 * Disabled until a repository is actually chosen, because the API answers this
 * from GitHub uncached — a call per row of a picker nobody has opened is a rate
 * limit spent on nothing.
 */
export function useRepositoryBranches(
  installationId: string | undefined,
  githubRepoId: number | undefined,
  options?: Omit<UseQueryOptions<BranchEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: installationsKeys.branches(installationId, githubRepoId),
    queryFn:
      installationId && githubRepoId
        ? () => app.installations.branches(installationId, githubRepoId)
        : skipToken,
    ...options,
  });
}

/** One repository, as a picker names it: our installation row plus GitHub's id. */
export interface RepositoryRef {
  installationId: string;
  githubRepoId: number;
}

/**
 * The branches of several repositories at once — what New session needs, since
 * its repository chip multi-selects and each selected row carries its own
 * branch.
 *
 * `useQueries` rather than a hook per repository: the number of selected
 * repositories changes as somebody picks them, and a hook cannot be called in a
 * loop. Each entry is keyed exactly as {@link useRepositoryBranches} keys it, so
 * the two share a cache rather than fetching the same branches twice.
 */
export function useRepositoryBranchesFor(repositories: readonly RepositoryRef[]) {
  const app = useConsumerApp();

  return useQueries({
    queries: repositories.map((repository) => ({
      queryKey: installationsKeys.branches(repository.installationId, repository.githubRepoId),
      queryFn: () => app.installations.branches(repository.installationId, repository.githubRepoId),
    })),
    combine: (results) => ({
      /** Branches by `githubRepoId`, holding only the repositories that answered. */
      byRepository: new Map(
        results.flatMap((result, index) => {
          const repository = repositories[index];
          return result.data && repository
            ? ([[repository.githubRepoId, result.data]] as [number, BranchEntity[]][])
            : [];
        }),
      ),
      isPending: results.some((result) => result.isPending),
    }),
  });
}

/**
 * The repositories of several installations, merged into one list.
 *
 * A workspace may have the App installed on more than one account — a personal
 * one and an organisation's — and the picker is one list rather than one per
 * account. Each row carries the installation it came from, because
 * `githubRepoId` alone is not unique across two installations and the create
 * call names a repository by the pair.
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
    }),
  });
}
