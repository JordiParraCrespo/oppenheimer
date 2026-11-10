import type { QueueSearch } from './queue-search';
import type { ReviewSearch } from './review-deck';

/**
 * Where a pull request was opened from, and so where its Back goes: the queue
 * as it was filtered, or the review deck on the card it was opened from.
 */
export type PullsReturn =
  | { to: 'queue'; search: QueueSearch }
  | { to: 'deck'; search: ReviewSearch };

/** The Back of a pull request: its link and the copy that names it. Opened cold, it is the queue. */
export function pullsReturnLink(from: PullsReturn | undefined) {
  return from?.to === 'deck'
    ? ({
        to: '/pulls/review',
        search: from.search,
        label: 'pullRequests.detail.backToDeck',
      } as const)
    : ({ to: '/pulls', search: from?.search ?? {}, label: 'pullRequests.detail.back' } as const);
}
