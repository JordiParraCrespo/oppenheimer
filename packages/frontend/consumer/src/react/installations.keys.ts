'use client';

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
