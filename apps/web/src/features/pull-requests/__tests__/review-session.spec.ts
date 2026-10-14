import type { HostEntity, PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { reviewHost, toReviewSession } from '../lib/review-session';

/**
 * Review in a session: which host it runs on when the reader picks none, and
 * the session it asks for — the head branch of the pull request's own
 * repository, Claude Code, and a first task that opens short and edits nothing.
 */
function host(id: string, online: boolean): HostEntity {
  return { id, name: id, online } as HostEntity;
}

const PULL = {
  installationId: 'inst-1',
  githubRepoId: 42,
  repository: 'acme/web',
  number: 14,
  title: 'Fix the empty state',
  headRef: 'fix/empty-state',
  baseRef: 'main',
} as PullRequestDetailEntity;

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

describe('the session a review asks for', () => {
  const input = toReviewSession(PULL, 'studio');

  it('checks out the head branch of the pull request’s repository on the picked host', () => {
    expect(input).toMatchObject({
      hostId: 'studio',
      agent: 'claude-code',
      checkouts: [{ installationId: 'inst-1', githubRepoId: 42, baseBranch: 'fix/empty-state' }],
      cwdGithubRepoId: 42,
      launch: { permission: 'auto' },
    });
  });

  it('starts on a prompt that reads the diff against the base, opens short and edits nothing', () => {
    expect(input.prompt).toContain('#14 in acme/web');
    expect(input.prompt).toContain('git diff origin/main...HEAD');
    expect(input.prompt).toContain('2 or 3 short lines');
    expect(input.prompt).toContain('Do not edit files');
  });
});
