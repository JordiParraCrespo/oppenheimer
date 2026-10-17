import { describe, expect, it } from 'vitest';
import { SessionShareEntity, type SessionShareSettings } from '../domain/session-share.entity';

/**
 * Who a share opens for, and what it lets them do. A wrong answer here is a
 * terminal on somebody's machine handed to a person it was not shared with.
 */

const NOW = new Date('2026-10-13T12:00:00Z');
const HOUR = 60 * 60_000;
const ALICE = { userId: 'u-alice', email: 'Alice@Example.com', emailVerified: true };

function share(settings: Partial<SessionShareSettings> = {}) {
  return SessionShareEntity.share({
    organizationId: 'org-1',
    sessionId: 'session-1',
    sharedByUserId: 'u-owner',
    settings: { audience: 'link', access: 'read', lifetime: '24h', ...settings },
    now: NOW,
  });
}

describe('SessionShareEntity', () => {
  it('opens for anyone signed in when shared as a link', () => {
    expect(share().refusalFor(ALICE, NOW)).toBeNull();
  });

  it('opens only for the people it names, by verified email, whatever its case', () => {
    const named = share({ audience: 'people', people: ['alice@example.com'] });
    expect(named.refusalFor(ALICE, NOW)).toBeNull();
    expect(named.refusalFor({ ...ALICE, email: 'bob@example.com' }, NOW)).toBe('not_invited');
    // Regression guard: an unverified address is a claim anybody can make at sign-up.
    expect(named.refusalFor({ ...ALICE, emailVerified: false }, NOW)).toBe('not_invited');
  });

  it('opens nothing once expired', () => {
    const hour = share({ lifetime: '1h' });
    expect(hour.refusalFor(ALICE, new Date(NOW.getTime() + HOUR - 1))).toBeNull();
    expect(hour.refusalFor(ALICE, new Date(NOW.getTime() + HOUR))).toBe('gone');
    expect(share({ lifetime: null }).refusalFor(ALICE, new Date('2030-01-01'))).toBeNull();
  });

  it('lets only named people write, and never past a day', () => {
    // A link that types would be a shell for whoever finds the address.
    expect(() => share({ access: 'write', lifetime: '1h' })).toThrow();
    const people = { audience: 'people' as const, people: ['alice@example.com'] };
    expect(() => share({ ...people, access: 'write', lifetime: '7d' })).toThrow();
    expect(() => share({ ...people, access: 'write', lifetime: null })).toThrow();
    const writing = share({ ...people, access: 'write', lifetime: '24h' });
    expect(writing.expiresAt).toEqual(new Date(NOW.getTime() + 24 * HOUR));
  });

  it('keeps its address and its id when shared again, acting as whoever shared last', () => {
    const first = share();
    const { id, slug } = first;
    first.reshare(
      'u-other',
      { audience: 'people', access: 'read', people: ['b@x.dev'], lifetime: '8h' },
      NOW,
    );
    expect(first.id).toBe(id);
    expect(first.slug).toBe(slug);
    expect(first.sharedByUserId).toBe('u-other');
    expect(first.people).toEqual(['b@x.dev']);
    // A new share is a new address, so stopping and sharing again retires the old one.
    expect(share().slug).not.toBe(slug);
  });

  it('narrows its people without touching access or expiry, and keeps at least one', () => {
    const named = share({ audience: 'people', people: ['a@x.dev', 'b@x.dev'], lifetime: '8h' });
    const expiresAt = named.expiresAt;
    named.setPeople(['B@x.dev']);
    expect(named.people).toEqual(['b@x.dev']);
    expect(named.expiresAt).toEqual(expiresAt);
    expect(() => named.setPeople([])).toThrow();
    expect(() => share().setPeople(['a@x.dev'])).toThrow();
  });
});
