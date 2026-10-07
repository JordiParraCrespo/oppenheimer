import { describe, expect, it } from 'vitest';
import type { PullRequestSnapshot } from '../../github/application/pull-request-access.port';
import { analyticsWindow } from '../domain/pull-request-analytics.policy';
import { PullRequestMapper } from '../pull-request.mapper';

/**
 * A part GitHub did not give is not an empty part: unread files are not a
 * tiny, safe change, and unread reviews are not "nobody reviewed it".
 */
const NOW = new Date('2026-10-06T12:00:00Z');

type Part = 'files' | 'checks' | 'reviews';

function snapshot(missing: Part[]): PullRequestSnapshot {
  return {
    repository: {
      installationId: 'inst',
      githubRepoId: 1,
      name: 'xrp',
      fullName: 'acme/xrp',
      defaultBranch: 'main',
      private: true,
    },
    pull: {
      number: 7,
      title: 'Tidy the auth guard',
      htmlUrl: 'https://github.com/acme/xrp/pull/7',
      authorLogin: 'bo',
      draft: false,
      state: 'closed',
      merged: true,
      mergedAt: '2026-10-05T12:00:00Z',
      headRef: 'tidy',
      headSha: 'abc',
      baseRef: 'main',
      createdAt: '2026-10-04T12:00:00Z',
      updatedAt: '2026-10-05T12:00:00Z',
      closedAt: '2026-10-05T12:00:00Z',
      requestedReviewers: [],
      body: '',
      additions: 3,
      deletions: 1,
      changedFiles: 1,
      mergeable: true,
      mergeableState: 'clean',
    },
    files: missing.includes('files')
      ? { value: null, refusal: 'forbidden' }
      : { value: ['README.md'], refusal: null },
    checks: missing.includes('checks')
      ? { value: null, refusal: 'forbidden' }
      : { value: { state: 'passing', total: 1, passed: 1, failed: 0, pending: 0 }, refusal: null },
    reviews: missing.includes('reviews')
      ? { value: null, refusal: 'failed' }
      : {
          value: [{ id: 1, login: 'ana', state: 'APPROVED', submittedAt: '2026-10-05T00:00:00Z' }],
          refusal: null,
        },
  };
}

describe('a pull request read in part', () => {
  const mapper = new PullRequestMapper();

  it('says which parts are unread and never puts unread files in the quick lane', () => {
    const row = mapper.toRow(snapshot(['files', 'reviews']), 'ana', NOW);
    expect(row.unread).toEqual(['files', 'reviews']);
    expect(row.lane).toBe('medium');
    expect(row.laneReason).toEqual({ code: 'files_unread', lines: 4 });
  });

  it('leaves unread reviews and unread files out of the review figures and the lane mix', () => {
    const analytics = (closed: PullRequestSnapshot) =>
      mapper.toAnalytics({
        range: 'week',
        window: analyticsWindow('week', NOW),
        open: [],
        closed: [closed],
        // The figures count listings; this read filled the one it has.
        counted: [closed.pull],
        viewerLogin: 'ana',
        now: NOW,
        complete: true,
        unreadable: [],
      });

    const read = analytics(snapshot([]));
    expect(read.reviewedByYou.value).toBe(1);
    expect(read.waitForReview.value).toBe(12);
    expect(read.lanes.find((lane) => lane.lane === 'quick')?.value).toBe(1);

    const unread = analytics(snapshot(['files', 'reviews']));
    expect(unread.merged.value).toBe(1);
    expect(unread.reviewedByYou.value).toBe(0);
    expect(unread.waitForReview.value).toBeNull();
    expect(unread.lanes.every((lane) => lane.value === 0)).toBe(true);
  });

  it('holds a pull request whose checks GitHub would not show: it is never ready to merge', () => {
    const row = mapper.toRow(
      {
        ...snapshot(['checks']),
        pull: { ...snapshot([]).pull, state: 'open', merged: false, mergedAt: null },
      },
      'ana',
      NOW,
    );
    expect(row.checks).toBe('unavailable');
    expect(row.checksRefusal).toBe('forbidden');
    expect(row.blocker).toBe('checks_unavailable');
  });

  it('names each gap once, with the refusal GitHub gave', () => {
    const repository = snapshot([]).repository;
    expect(
      mapper.toUnreadable([
        {
          repository,
          snapshots: [],
          gaps: [
            { what: 'checks', refusal: 'forbidden' },
            { what: 'checks', refusal: 'forbidden' },
          ],
        },
        { repository, snapshots: [], gaps: [{ what: 'pull_requests', refusal: 'rate_limited' }] },
      ]),
    ).toEqual([
      { what: 'checks', refusal: 'forbidden' },
      { what: 'pull_requests', refusal: 'rate_limited' },
    ]);
  });
});
