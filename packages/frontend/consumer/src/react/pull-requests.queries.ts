'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  keepPreviousData,
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  LineCommentInput,
  MergeMethod,
  PullRequestActivityItem,
  PullRequestAddress,
  PullRequestAnalytics,
  PullRequestAnalyticsRange,
  PullRequestComment,
  PullRequestDetailEntity,
  PullRequestFile,
  PullRequestQueue,
  PullRequestScope,
  ReviewInput,
  WatchedRepository,
} from '../modules/pull-requests/pull-request.entity';
import { useConsumerApp } from './context';
import { usePollWhile } from './live-poll';

/**
 * Query key factory for the Pull requests area. Everything sits under one
 * root because a review, a merge or a watch can move a pull request between
 * the queue's scopes, change its briefing and the analytics at once.
 *
 * ```
 * ['pullRequests', 'queue', scope]
 * ['pullRequests', 'detail', installationId, githubRepoId, number]
 * ['pullRequests', 'detail', …, 'files' | 'comments' | 'activity']
 * ['pullRequests', 'repositories']
 * ['pullRequests', 'analytics', range]
 * ```
 */
export const pullRequestsKeys = {
  all: ['pullRequests'] as const,
  queues: () => [...pullRequestsKeys.all, 'queue'] as const,
  queue: (scope: PullRequestScope) => [...pullRequestsKeys.queues(), scope] as const,
  details: () => [...pullRequestsKeys.all, 'detail'] as const,
  detail: (address: PullRequestAddress | undefined) =>
    [
      ...pullRequestsKeys.details(),
      address?.installationId,
      address?.githubRepoId,
      address?.number,
    ] as const,
  files: (address: PullRequestAddress | undefined) =>
    [...pullRequestsKeys.detail(address), 'files'] as const,
  comments: (address: PullRequestAddress | undefined) =>
    [...pullRequestsKeys.detail(address), 'comments'] as const,
  activity: (address: PullRequestAddress | undefined) =>
    [...pullRequestsKeys.detail(address), 'activity'] as const,
  repositories: () => [...pullRequestsKeys.all, 'repositories'] as const,
  analytics: () => [...pullRequestsKeys.all, 'analytics'] as const,
  analyticsRange: (range: PullRequestAnalyticsRange) =>
    [...pullRequestsKeys.analytics(), range] as const,
};

/**
 * One scope's queue, longest wait first, with the counts the header and the
 * scope and lane controls show. The previous scope stays on screen while the
 * next loads.
 */
export function usePullRequestQueue<TData = PullRequestQueue>(
  scope: PullRequestScope,
  options?: Omit<UseQueryOptions<PullRequestQueue, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<PullRequestQueue, Error, TData>({
    queryKey: pullRequestsKeys.queue(scope),
    queryFn: () => app.pullRequests.queue(scope),
    placeholderData: keepPreviousData,
    ...options,
    // The rows are drawn from the first read; each poll fills a few more of
    // their parts, until the answer says it has stopped filling (#247).
    ...usePollWhile<PullRequestQueue>(
      'pullRequestsFilling',
      pullRequestsKeys.queue(scope),
      (data) => data?.filling === true,
    ),
  });
}

export function usePullRequest(address: PullRequestAddress | undefined) {
  const app = useConsumerApp();
  return useQuery<PullRequestDetailEntity, Error>({
    queryKey: pullRequestsKeys.detail(address),
    queryFn: address ? () => app.pullRequests.find(address) : skipToken,
  });
}

/** The diff, file by file: the Changes view. */
export function usePullRequestFiles(address: PullRequestAddress | undefined) {
  const app = useConsumerApp();
  return useQuery<PullRequestFile[], Error>({
    queryKey: pullRequestsKeys.files(address),
    queryFn: address ? () => app.pullRequests.files(address) : skipToken,
  });
}

/** The line comments already posted on GitHub, drawn on the diff. */
export function usePullRequestComments(address: PullRequestAddress | undefined) {
  const app = useConsumerApp();
  return useQuery<PullRequestComment[], Error>({
    queryKey: pullRequestsKeys.comments(address),
    queryFn: address ? () => app.pullRequests.comments(address) : skipToken,
  });
}

/** Its conversation: comments, commits, reviews and events, drawn under the description. */
export function usePullRequestActivity(address: PullRequestAddress | undefined) {
  const app = useConsumerApp();
  return useQuery<PullRequestActivityItem[], Error>({
    queryKey: pullRequestsKeys.activity(address),
    queryFn: address ? () => app.pullRequests.activity(address) : skipToken,
  });
}

/** Every repository the workspace's installations reach, and whether the caller watches it. */
export function useWatchedRepositories<TData = WatchedRepository[]>(
  options?: Omit<UseQueryOptions<WatchedRepository[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<WatchedRepository[], Error, TData>({
    queryKey: pullRequestsKeys.repositories(),
    queryFn: () => app.pullRequests.repositories(),
    ...options,
  });
}

/**
 * The review period's numbers. The one read of this feature that is kept in
 * the browser's cache, and it says so here: the queue and the details hold
 * private repositories' code — titles, branches, file paths — while these are
 * counts, medians, a lane mix and dates that name nothing. Reading them from
 * storage is what spares the page a skeleton on every visit.
 */
export function usePullRequestAnalytics(range: PullRequestAnalyticsRange) {
  const app = useConsumerApp();
  return useQuery<PullRequestAnalytics, Error>({
    queryKey: pullRequestsKeys.analyticsRange(range),
    queryFn: () => app.pullRequests.analytics(range),
    placeholderData: keepPreviousData,
    meta: { persist: true },
  });
}

function useInvalidatePullRequests() {
  const queryClient = useQueryClient();
  // One root covers the queue, the details and the period's numbers alike:
  // watching a repository changes all of them.
  return () => queryClient.invalidateQueries({ queryKey: pullRequestsKeys.all });
}

export interface SetRepositoryWatchVariables {
  repository: Pick<WatchedRepository, 'installationId' | 'githubRepoId'>;
  watching: boolean;
}

/** Watching moves a repository's pull requests in or out of the Watching scope and the analytics. */
export function useSetRepositoryWatch(
  options?: UseMutationOptions<void, Error, SetRepositoryWatchVariables>,
) {
  const app = useConsumerApp();
  const invalidate = useInvalidatePullRequests();
  return useMutation({
    mutationFn: ({ repository, watching }: SetRepositoryWatchVariables) =>
      app.pullRequests.setWatching(repository, watching),
    ...withCacheOnSuccess(options, invalidate),
  });
}

export interface SubmitReviewVariables {
  address: PullRequestAddress;
  review: ReviewInput;
}

/** A review in the caller's name; approving also merges when GitHub allows it. */
export function useSubmitPullRequestReview(
  options?: UseMutationOptions<{ merged: boolean }, Error, SubmitReviewVariables>,
) {
  const app = useConsumerApp();
  const invalidate = useInvalidatePullRequests();
  return useMutation({
    mutationFn: ({ address, review }: SubmitReviewVariables) =>
      app.pullRequests.submitReview(address, review),
    ...withCacheOnSuccess(options, invalidate),
  });
}

export interface AddCommentVariables {
  address: PullRequestAddress;
  comment: LineCommentInput;
}

/** One line comment posted at once, outside a review. */
export function useAddPullRequestComment(
  options?: UseMutationOptions<void, Error, AddCommentVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ address, comment }: AddCommentVariables) =>
      app.pullRequests.addComment(address, comment),
    ...withCacheOnSuccess(options, (_data, { address }) =>
      queryClient.invalidateQueries({ queryKey: pullRequestsKeys.comments(address) }),
    ),
  });
}

export interface MergePullRequestVariables {
  address: PullRequestAddress;
  method?: MergeMethod;
}

/** Merges in the caller's name. GitHub refusing it (`GITHUB_014`) is an answer: it waits. */
export function useMergePullRequest(
  options?: UseMutationOptions<void, Error, MergePullRequestVariables>,
) {
  const app = useConsumerApp();
  const invalidate = useInvalidatePullRequests();
  return useMutation({
    mutationFn: ({ address, method }: MergePullRequestVariables) =>
      app.pullRequests.merge(address, method),
    ...withCacheOnSuccess(options, invalidate),
  });
}
