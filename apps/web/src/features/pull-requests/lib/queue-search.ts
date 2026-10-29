import { searchText } from '@oppenheimer/frontend-web';
import {
  PULL_REQUEST_LANES,
  PULL_REQUEST_QUEUES,
  type PullRequestQueueName,
} from '@oppenheimer/shared/schemas/pull-request';
import { z } from 'zod';

/**
 * The queues that are empty until the reader watches a repository: every
 * queue reads only the watched ones, and these two hold nothing else. Their
 * empty state and their hint both point at Settings.
 */
export function needsWatchedRepositories(queue: PullRequestQueueName): boolean {
  return queue === 'all' || queue === 'watching';
}

/** The checks states the queue's Checks facet narrows to. */
export const QUEUE_CHECKS = ['passing', 'failing', 'running'] as const;
export type QueueChecks = (typeof QUEUE_CHECKS)[number];

/** How long a pull request has waited, in the Waiting facet's three steps. */
export const QUEUE_WAITS = ['hour', 'day', 'older'] as const;
export type QueueWait = (typeof QUEUE_WAITS)[number];

/**
 * The queue's scope, repository and facets, in the URL: a filtered queue is a
 * link someone can send, and Back from a pull request returns to it. The
 * search box is the table's own and stays out of it.
 * A value the schema does not accept reads as absent, which is the default.
 */
export const queueSearchSchema = z.object({
  scope: z.enum(PULL_REQUEST_QUEUES).optional().catch(undefined),
  lane: z.enum(PULL_REQUEST_LANES).optional().catch(undefined),
  checks: z.enum(QUEUE_CHECKS).optional().catch(undefined),
  wait: z.enum(QUEUE_WAITS).optional().catch(undefined),
  /** A repository's `owner/name`, picked beside the search. */
  repo: searchText,
});
export type QueueSearch = z.infer<typeof queueSearchSchema>;
