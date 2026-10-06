import type { PullRequestEntity, PullRequestLane } from '@oppenheimer/frontend-consumer';

export const QUEUE_PAGE_SIZE = 10;

/** The rows under the repository the sidebar picked, before the lane and the search. */
export function inRepository(
  rows: readonly PullRequestEntity[],
  repo: string | undefined,
): PullRequestEntity[] {
  return repo ? rows.filter((row) => row.repository === repo) : [...rows];
}

/** The rows the table shows: the lane, then the search over title, repository, number and author. */
export function filterQueue(
  rows: readonly PullRequestEntity[],
  lane: PullRequestLane | undefined,
  query: string,
): PullRequestEntity[] {
  const term = query.trim().toLowerCase().replace(/^#/, '');
  return rows.filter(
    (row) =>
      (!lane || row.lane === lane) &&
      (!term ||
        `${row.title} ${row.repository} ${row.number} ${row.author}`.toLowerCase().includes(term)),
  );
}
