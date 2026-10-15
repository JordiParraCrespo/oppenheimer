import { useWatchedRepositories } from '@oppenheimer/frontend-consumer/react';

/**
 * How many repositories the caller watches: what the settings layout answers
 * the sidebar's count slot with for the Watched repositories row. Nothing
 * while the list is unanswered.
 */
export function WatchedCount() {
  const { data: count } = useWatchedRepositories({
    select: (rows) => rows.filter((row) => row.watching).length,
  });
  return count === undefined ? null : count;
}
