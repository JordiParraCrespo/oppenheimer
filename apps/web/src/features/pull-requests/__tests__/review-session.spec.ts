import type { HostEntity, ReviewSession } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { latestReview, reviewGroups, reviewHost } from '../lib/review-session';

/**
 * Review sessions in the console: the host one runs on when the reader picks
 * none, the session a pull request's Chat tab shows, and For review's groups
 * and search.
 */
function host(id: string, online: boolean): HostEntity {
  return { id, name: id, online } as HostEntity;
}

function review(sessionId: string, fields: Partial<ReviewSession>): ReviewSession {
  return {
    sessionId,
    installationId: 'inst-1',
    githubRepoId: 42,
    number: 14,
    repository: 'acme/web',
    title: 'Fix the empty state',
    headRef: 'fix/empty',
    hostId: 'laptop',
    state: 'open',
    createdAt: new Date(0),
    ...fields,
  };
}

describe('the host a review session runs on', () => {
  const hosts = [host('laptop', true), host('studio', true), host('old', false)];

  it('is the latest session’s host while it is online', () => {
    expect(reviewHost(hosts, ['studio', 'laptop'])?.id).toBe('studio');
  });

  it('skips a recent host that is offline for the next one that is not', () => {
    expect(reviewHost(hosts, ['old', 'studio'])?.id).toBe('studio');
  });

  it('falls back to the first online host, and to none when every host is offline', () => {
    expect(reviewHost(hosts, [])?.id).toBe('laptop');
    expect(reviewHost([host('old', false)], ['old'])).toBeUndefined();
  });
});

describe('a pull request’s review session', () => {
  const address = { installationId: 'inst-1', githubRepoId: 42, number: 14 };

  it('is the newest of the list that reviews it, and none when no session does', () => {
    const list = [review('other', { number: 15 }), review('newest', {}), review('older', {})];
    expect(latestReview(list, address)?.sessionId).toBe('newest');
    expect(latestReview([review('other', { githubRepoId: 7 })], address)).toBeNull();
  });
});

describe('For review', () => {
  const list = [
    review('a', { repository: 'acme/web', number: 14, title: 'Fix the empty state' }),
    review('b', { repository: 'acme/runner', number: 3, title: 'Retry registration' }),
    review('c', { repository: 'acme/web', number: 9, title: 'Rotate the token' }),
  ];

  it('groups by repository in the order each one’s newest session started', () => {
    expect(
      reviewGroups(list, '').map((group) => [
        group.repository,
        group.sessions.map((session) => session.sessionId),
      ]),
    ).toEqual([
      ['acme/web', ['a', 'c']],
      ['acme/runner', ['b']],
    ]);
  });

  it('searches the number, the title and the repository', () => {
    const ids = (query: string) =>
      reviewGroups(list, query).flatMap((group) => group.sessions.map((s) => s.sessionId));
    expect(ids('#9')).toEqual(['c']);
    expect(ids('retry')).toEqual(['b']);
    expect(ids('ACME/WEB')).toEqual(['a', 'c']);
  });
});
