'use client';

import type {
  PullRequestAddress,
  PullRequestAnalyticsRange,
  PullRequestQueueName,
} from '../modules/pull-requests/pull-request.entity';

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
  queue: (scope: PullRequestQueueName) => [...pullRequestsKeys.queues(), scope] as const,
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
  reviewSessions: () => [...pullRequestsKeys.all, 'review-sessions'] as const,
  analytics: () => [...pullRequestsKeys.all, 'analytics'] as const,
  analyticsRange: (range: PullRequestAnalyticsRange) =>
    [...pullRequestsKeys.analytics(), range] as const,
};
