import type { PullRequestEntity, PullRequestLane } from '@oppenheimer/frontend-consumer';
import type { QueueChecks, QueueWait } from './queue-search';

export const QUEUE_PAGE_SIZE = 10;

/** What narrows the queue: the repository, the three facets and the search. */
export interface QueueFilters {
  repo?: string;
  lane?: PullRequestLane;
  checks?: QueueChecks;
  wait?: QueueWait;
  query?: string;
}

type Facet = 'repo' | 'lane' | 'checks' | 'wait';

const HOUR = 3600;
const DAY = 24 * HOUR;

/** Which step of the Waiting facet a wait falls in. */
export function waitOf(seconds: number): QueueWait {
  if (seconds < HOUR) return 'hour';
  if (seconds <= DAY) return 'day';
  return 'older';
}

function matches(row: PullRequestEntity, filters: QueueFilters, except?: Facet): boolean {
  const term = (filters.query ?? '').trim().toLowerCase().replace(/^#/, '');
  return (
    (except === 'repo' || !filters.repo || row.repository === filters.repo) &&
    (except === 'lane' || !filters.lane || row.lane === filters.lane) &&
    (except === 'checks' || !filters.checks || row.checks === filters.checks) &&
    (except === 'wait' || !filters.wait || waitOf(row.waitingSeconds) === filters.wait) &&
    (!term ||
      `${row.title} ${row.repository} ${row.number} ${row.author}`.toLowerCase().includes(term))
  );
}

/** The rows the table shows, in the order the API gave them. */
export function filterQueue(
  rows: readonly PullRequestEntity[],
  filters: QueueFilters,
): PullRequestEntity[] {
  return rows.filter((row) => matches(row, filters));
}

/**
 * How many rows each option of a facet would leave: every other filter
 * applies, the facet's own does not, so a count is what picking it shows.
 * Keyed by the option's value; `all` is the facet unset.
 */
export function facetCounts(
  rows: readonly PullRequestEntity[],
  filters: QueueFilters,
  facet: Facet,
): Record<string, number> {
  const counts: Record<string, number> = { all: 0 };
  for (const row of rows) {
    if (!matches(row, filters, facet)) continue;
    counts.all = (counts.all ?? 0) + 1;
    const key =
      facet === 'repo'
        ? row.repository
        : facet === 'lane'
          ? row.lane
          : facet === 'checks'
            ? row.checks
            : waitOf(row.waitingSeconds);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
