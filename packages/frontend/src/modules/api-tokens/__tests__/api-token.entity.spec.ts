import type { Scope } from '@oppenheimer/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTokenEntity } from '../api-token.entity';

/**
 * The client-side reading of whether a credential still works. The table shows
 * one badge per token from `status`, and it is the only thing telling an admin
 * that a token stopped authenticating — a token reading "active" after it
 * expired sends whoever owns it debugging their own integration.
 *
 * `isExpired` reads the wall clock, so every test that depends on it pins the
 * clock rather than choosing dates far enough out to be safe for a while.
 */

const NOW = new Date('2026-06-15T12:00:00.000Z');

function token(
  overrides: {
    expiresAt?: Date | null;
    revokedAt?: Date | null;
    scopes?: Scope[];
    organizationIds?: string[] | null;
    ipAllowlist?: string[] | null;
    lastUsedAt?: Date | null;
  } = {},
): ApiTokenEntity {
  return new ApiTokenEntity(
    'token-1',
    'CI deploy key',
    'oppenheimer_ab12',
    overrides.scopes ?? (['leads:read'] as Scope[]),
    overrides.organizationIds ?? null,
    overrides.ipAllowlist ?? null,
    overrides.expiresAt ?? null,
    overrides.lastUsedAt ?? null,
    overrides.revokedAt ?? null,
    new Date('2026-01-01T00:00:00.000Z'),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

function at(now: Date) {
  vi.useFakeTimers({ now, shouldAdvanceTime: false });
}

describe('ApiTokenEntity', () => {
  describe('a token with no expiry and no revocation', () => {
    it('is active', () => {
      at(NOW);
      const subject = token();

      expect(subject.isRevoked).toBe(false);
      expect(subject.isExpired).toBe(false);
      expect(subject.isActive).toBe(true);
      expect(subject.status).toBe('active');
    });
  });

  describe('revocation', () => {
    it('reports a revoked token as revoked and inactive', () => {
      at(NOW);
      const subject = token({
        revokedAt: new Date('2026-05-01T00:00:00.000Z'),
      });

      expect(subject.isRevoked).toBe(true);
      expect(subject.isActive).toBe(false);
      expect(subject.status).toBe('revoked');
    });

    it('beats expiry in the status', () => {
      // A token that was revoked and then also passed its expiry is revoked.
      // "Expired" would suggest it can be renewed, which it cannot.
      at(NOW);
      const subject = token({
        revokedAt: new Date('2026-05-01T00:00:00.000Z'),
        expiresAt: new Date('2026-05-15T00:00:00.000Z'),
      });

      expect(subject.status).toBe('revoked');
    });

    it('is revoked even when the revocation timestamp is in the future', () => {
      // The field is a timestamp, not a schedule — the API writes it at the
      // moment of revocation. A clock-skewed future value still means revoked.
      at(NOW);
      const subject = token({
        revokedAt: new Date('2026-12-01T00:00:00.000Z'),
      });

      expect(subject.isRevoked).toBe(true);
    });
  });

  describe('expiry', () => {
    it('reports a past expiry as expired and inactive', () => {
      at(NOW);
      const subject = token({
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      expect(subject.isExpired).toBe(true);
      expect(subject.isActive).toBe(false);
      expect(subject.status).toBe('expired');
    });

    it('reports a future expiry as still active', () => {
      at(NOW);
      const subject = token({
        expiresAt: new Date('2026-07-01T00:00:00.000Z'),
      });

      expect(subject.isExpired).toBe(false);
      expect(subject.status).toBe('active');
    });

    it('treats the exact expiry instant as expired', () => {
      // `<=`, not `<`. A token whose `expiresAt` is exactly now no longer
      // authenticates server-side, and the badge has to agree.
      at(NOW);
      const subject = token({ expiresAt: NOW });

      expect(subject.isExpired).toBe(true);
    });

    it('flips as the clock passes the expiry, without the entity changing', () => {
      // The getter reads `Date.now()` on every access, so a table left open
      // across an expiry shows the right badge on its next render rather than
      // holding the reading it was constructed with.
      at(new Date('2026-06-15T11:59:59.000Z'));
      const subject = token({
        expiresAt: new Date('2026-06-15T12:00:00.000Z'),
      });
      expect(subject.status).toBe('active');

      vi.setSystemTime(new Date('2026-06-15T12:00:01.000Z'));
      expect(subject.status).toBe('expired');
    });

    it('never expires when expiresAt is null', () => {
      at(new Date('2099-01-01T00:00:00.000Z'));

      expect(token({ expiresAt: null }).isExpired).toBe(false);
    });
  });

  describe('the fields the table renders', () => {
    it('keeps the prefix, which is all of the secret anyone ever sees again', () => {
      expect(token().prefix).toBe('oppenheimer_ab12');
    });

    it('carries a null organization list as "every organization"', () => {
      // `null` and `[]` mean opposite things here — unrestricted versus
      // restricted to nothing — so the entity must not normalise one into the
      // other.
      expect(token({ organizationIds: null }).organizationIds).toBeNull();
      expect(token({ organizationIds: [] }).organizationIds).toEqual([]);
    });

    it('keeps a null IP allowlist distinct from an empty one', () => {
      expect(token({ ipAllowlist: null }).ipAllowlist).toBeNull();
      expect(token({ ipAllowlist: [] }).ipAllowlist).toEqual([]);
    });

    it('reports a token that has never been used as null, not as its creation date', () => {
      expect(token({ lastUsedAt: null }).lastUsedAt).toBeNull();
    });
  });
});
