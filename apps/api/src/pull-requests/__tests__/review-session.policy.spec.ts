import { describe, expect, it } from 'vitest';
import { reviewSessionInput } from '../domain/review-session.policy';

/**
 * The session a review asks for: Claude Code, the head branch of the pull
 * request's own repository, edits approved, and a first task that reads the
 * diff against the base, opens short and changes nothing.
 */
const PULL = {
  installationId: 'inst-1',
  githubRepoId: 42,
  repository: 'acme/web',
  number: 14,
  title: 'Fix the empty state',
  headRef: 'fix/empty-state',
  baseRef: 'main',
};

describe('a review session', () => {
  const input = reviewSessionInput(PULL, 'studio');

  it('checks out the head branch on the picked host, with Claude Code launched in it', () => {
    expect(input).toMatchObject({
      hostId: 'studio',
      agent: 'claude-code',
      name: 'Review #14',
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
