import { describe, expect, it } from 'vitest';
import { hashShareToken, SessionShareLinkEntity } from '../domain/session-share-link.entity';

/**
 * Who a share link opens for. A wrong answer here is a terminal on somebody's
 * machine handed to a person it was not shared with.
 */

const NOW = new Date('2026-10-08T12:00:00Z');
const ALICE = { userId: 'u-alice', email: 'Alice@Example.com', emailVerified: true };

function issue(overrides: Partial<Parameters<typeof SessionShareLinkEntity.issue>[0]> = {}) {
  return SessionShareLinkEntity.issue({
    organizationId: 'org-1',
    sessionId: 'session-1',
    createdByUserId: 'u-owner',
    access: 'read',
    audience: 'anyone',
    now: NOW,
    ...overrides,
  });
}

describe('SessionShareLinkEntity', () => {
  it('keeps only the digest of the secret it hands out', () => {
    const { link, token } = issue();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link.tokenHash).toBe(hashShareToken(token));
  });

  it('opens for anyone, signed in or not, when shared with anyone', () => {
    const { link } = issue();
    expect(link.refusalFor(null, NOW)).toBeNull();
    expect(link.refusalFor(ALICE, NOW)).toBeNull();
  });

  it('asks a signed-out holder to sign in when shared with accounts', () => {
    const { link } = issue({ audience: 'accounts' });
    expect(link.refusalFor(null, NOW)).toBe('sign_in');
    expect(link.refusalFor(ALICE, NOW)).toBeNull();
  });

  it('opens only for the people it names, by verified email, whatever its case', () => {
    const { link } = issue({ audience: 'people', people: ['alice@example.com'] });
    expect(link.refusalFor(null, NOW)).toBe('sign_in');
    expect(link.refusalFor(ALICE, NOW)).toBeNull();
    expect(link.refusalFor({ ...ALICE, email: 'bob@example.com' }, NOW)).toBe('not_invited');
    // Regression guard: an unverified address is a claim anybody can make at sign-up.
    expect(link.refusalFor({ ...ALICE, emailVerified: false }, NOW)).toBe('not_invited');
  });

  it('keeps no list of people on any other audience', () => {
    const { link } = issue({ audience: 'accounts', people: ['alice@example.com'] });
    expect(link.people).toEqual([]);
  });

  it('opens nothing once expired or revoked, for anyone', () => {
    const { link } = issue({ lifetime: '1h' });
    expect(link.refusalFor(ALICE, new Date(NOW.getTime() + 59 * 60_000))).toBeNull();
    expect(link.refusalFor(ALICE, new Date(NOW.getTime() + 60 * 60_000))).toBe('gone');

    const { link: revoked } = issue();
    revoked.revoke(NOW);
    expect(revoked.refusalFor(null, NOW)).toBe('gone');
  });
});
