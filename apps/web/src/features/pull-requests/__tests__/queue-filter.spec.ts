import type { PullRequestEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { pullRequestSearchSchema } from '../lib/pull-request-search';
import { facetCounts, filterQueue, waitOf } from '../lib/queue-filter';

/**
 * The queue's filters: what each facet keeps, what each option would leave
 * (every other facet applied, its own not), and the link that still names the
 * retired Briefing view.
 */
function row(
  number: number,
  fields: Partial<Pick<PullRequestEntity, 'repository' | 'lane' | 'checks' | 'waitingSeconds'>>,
): PullRequestEntity {
  return {
    number,
    title: `pull ${number}`,
    author: 'ada',
    repository: 'acme/web',
    lane: 'quick',
    checks: 'passing',
    waitingSeconds: 60,
    ...fields,
  } as PullRequestEntity;
}

const ROWS = [
  row(1, { lane: 'deep', checks: 'failing', waitingSeconds: 2 * 86_400 }),
  row(2, { lane: 'deep', checks: 'passing', waitingSeconds: 7_200, repository: 'acme/api' }),
  row(3, { lane: 'quick', checks: 'running', waitingSeconds: 600 }),
  row(4, { lane: 'medium', checks: 'passing', waitingSeconds: 30, repository: 'acme/api' }),
];

describe('the queue filters', () => {
  it('puts a wait in the Waiting facet’s three steps', () => {
    expect([59 * 60, 3_600, 86_400, 86_401].map(waitOf)).toEqual(['hour', 'day', 'day', 'older']);
  });

  it('keeps the rows every filter matches, in the order given', () => {
    const numbers = (filters: Parameters<typeof filterQueue>[1]) =>
      filterQueue(ROWS, filters).map((pull) => pull.number);
    expect(numbers({ lane: 'deep' })).toEqual([1, 2]);
    expect(numbers({ lane: 'deep', checks: 'passing' })).toEqual([2]);
    expect(numbers({ repo: 'acme/api', wait: 'hour' })).toEqual([4]);
    expect(numbers({ query: '#3' })).toEqual([3]);
  });

  it('counts each option with the other facets applied and its own left out', () => {
    const filters = { lane: 'deep' as const, checks: 'passing' as const };
    expect(facetCounts(ROWS, filters, 'lane')).toEqual({ all: 2, deep: 1, medium: 1 });
    expect(facetCounts(ROWS, filters, 'checks')).toEqual({ all: 2, failing: 1, passing: 1 });
    expect(facetCounts(ROWS, filters, 'repo')).toEqual({ all: 1, 'acme/api': 1 });
  });
});

describe('the pull request’s view in the address', () => {
  it('opens a link that still names the Briefing on the description', () => {
    expect(pullRequestSearchSchema.parse({ view: 'briefing' })).toEqual({ view: undefined });
    expect(pullRequestSearchSchema.parse({ view: 'changes' })).toEqual({ view: 'changes' });
    expect(pullRequestSearchSchema.parse({ view: 'chat' })).toEqual({ view: undefined });
  });
});
