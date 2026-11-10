import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePrefetchPullRequestBrief } from '@oppenheimer/frontend-consumer/react';

/** Draws nothing: asks for the next card's brief while the one on screen is read. */
export function BriefAhead({ address }: { address: PullRequestAddress }) {
  usePrefetchPullRequestBrief(address);
  return null;
}
