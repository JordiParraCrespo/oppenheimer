import { describe, expect, it } from 'vitest';
import { chooseToken, isUsable, type TokenCandidate } from '../domain/token-key.policy';

/**
 * Which of a person's tokens reads a repository the App is not on (§6.2). A
 * wrong pick reads with a token that may not see the repository's checks, or
 * one the person meant to keep for another organisation, and nothing fails.
 */
const NOW = new Date('2026-10-26T12:00:00Z');

function token(id: string, repositoryIds: number[], overrides: Partial<TokenCandidate> = {}) {
  return {
    id,
    repositoryIds,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    expiresAt: null,
    refusedAt: null,
    ...overrides,
  };
}

describe('choosing the token that reads a repository', () => {
  const orgWide = token('org-wide', [1, 2, 3, 4]);
  const oneRepo = token('one-repo', [2]);
  const classic = token('classic', [1, 2, 3, 4, 5, 6, 7, 8]);

  it('takes the token the person pinned, even over a narrower one', () => {
    expect(chooseToken(2, [orgWide, oneRepo, classic], 'classic', NOW)?.id).toBe('classic');
  });

  it('takes the narrowest token when nothing is pinned', () => {
    expect(chooseToken(2, [classic, orgWide, oneRepo], null, NOW)?.id).toBe('one-repo');
    expect(chooseToken(3, [classic, orgWide, oneRepo], null, NOW)?.id).toBe('org-wide');
  });

  it('breaks a tie with the most recently added', () => {
    const older = token('older', [9]);
    const newer = token('newer', [9], { createdAt: new Date('2026-10-20T00:00:00Z') });

    expect(chooseToken(9, [older, newer], null, NOW)?.id).toBe('newer');
  });

  // A pin to a token that no longer opens the repository, or no longer works,
  // must not leave the repository unread while another token could read it.
  it('passes over a pin whose token cannot read the repository', () => {
    const refused = token('one-repo', [2], { refusedAt: new Date('2026-10-25T00:00:00Z') });

    expect(chooseToken(2, [orgWide, refused], 'one-repo', NOW)?.id).toBe('org-wide');
    expect(chooseToken(5, [orgWide, classic], 'org-wide', NOW)?.id).toBe('classic');
  });

  it('chooses nobody when no usable token opens the repository', () => {
    const expired = token('expired', [7], { expiresAt: new Date('2026-10-26T11:59:59Z') });

    expect(chooseToken(7, [expired], null, NOW)).toBeNull();
    expect(chooseToken(99, [orgWide], null, NOW)).toBeNull();
  });
});

describe('a token GitHub still accepts', () => {
  it('is one with no refusal and no expiry, or an expiry still ahead', () => {
    expect(isUsable(token('a', []), NOW)).toBe(true);
    expect(isUsable(token('a', [], { expiresAt: new Date('2026-10-27T00:00:00Z') }), NOW)).toBe(
      true,
    );
  });

  it('is not one GitHub refused, or one past its expiry', () => {
    expect(isUsable(token('a', [], { refusedAt: NOW }), NOW)).toBe(false);
    expect(isUsable(token('a', [], { expiresAt: NOW }), NOW)).toBe(false);
  });
});
