import { describe, expect, it } from 'vitest';
import { ApiTokenEntity } from '../domain/api-token.entity';
import { API_TOKEN_PREFIX, hashApiTokenSecret } from '../domain/api-token-secret.factory';
import { ApiTokenRevokedDomainEvent } from '../domain/events/api-token-revoked.domain-event';

const issue = (overrides: Partial<Parameters<typeof ApiTokenEntity.issue>[0]> = {}) =>
  ApiTokenEntity.issue({
    userId: 'user-1',
    name: 'CI deploy',
    scopes: ['users:read'],
    ...overrides,
  });

describe('ApiTokenEntity.issue', () => {
  it('returns a namespaced secret and stores only its digest', () => {
    const { token, secret } = issue();

    expect(secret.startsWith(`${API_TOKEN_PREFIX}_`)).toBe(true);
    expect(token.tokenHash).toBe(hashApiTokenSecret(secret));
    expect(token.tokenHash).not.toContain(secret);
  });

  it('keeps a non-secret display prefix that the secret starts with', () => {
    const { token, secret } = issue();
    expect(secret.startsWith(token.prefix)).toBe(true);
    expect(token.prefix.length).toBeLessThan(secret.length);
  });

  it('mints a different secret every time', () => {
    expect(issue().secret).not.toBe(issue().secret);
  });

  it('sorts scopes into catalog order so stored lists are stable', () => {
    const { token } = issue({ scopes: ['users:read', 'profile:read'] });
    expect(token.scopes).toEqual(['profile:read', 'users:read']);
  });

  it('does not expire by default', () => {
    expect(issue().token.expiresAt).toBeNull();
  });

  it('computes the expiry from the requested lifetime', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token } = issue({ expiresInDays: 30, now });
    expect(token.expiresAt).toEqual(new Date('2026-01-31T00:00:00Z'));
  });

  it('rejects a nonsensical lifetime', () => {
    expect(() => issue({ expiresInDays: 0 })).toThrow();
    expect(() => issue({ expiresInDays: -1 })).toThrow();
    expect(() => issue({ expiresInDays: 1.5 })).toThrow();
    expect(() => issue({ expiresInDays: 100_000 })).toThrow();
  });

  it('treats an empty organization list as unrestricted, and normalizes a restricted one', () => {
    expect(issue({ organizationIds: [] }).token.organizationIds).toBeNull();
    expect(issue().token.organizationIds).toBeNull();
    expect(issue({ organizationIds: ['org-b', 'org-a', 'org-b'] }).token.organizationIds).toEqual([
      'org-a',
      'org-b',
    ]);
  });

  it('refuses to mint a token that grants nothing', () => {
    expect(() => issue({ scopes: [] })).toThrow();
  });

  it('refuses to mint a token with no name or owner', () => {
    expect(() => issue({ name: '  ' })).toThrow();
    expect(() => issue({ userId: '' })).toThrow();
  });
});

describe('ApiTokenEntity usability', () => {
  it('reports expiry once the deadline passes', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token } = issue({ expiresInDays: 1, now });

    expect(token.rejectionReason({ now: new Date('2026-01-01T23:59:00Z') })).toBeNull();
    expect(token.rejectionReason({ now: new Date('2026-01-02T00:00:00Z') })).toBe('expired');
  });

  it('raises one revoked event, naming the token and owner its cached session is dropped by, however often it is revoked', () => {
    const { token } = issue();
    token.revoke(new Date('2026-01-01T00:00:00Z'));
    token.revoke(new Date('2026-06-01T00:00:00Z'));

    expect(token.revokedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(token.domainEvents).toHaveLength(1);
    expect(token.domainEvents[0]).toBeInstanceOf(ApiTokenRevokedDomainEvent);
    expect(token.domainEvents[0]).toMatchObject({ aggregateId: token.id, userId: 'user-1' });
  });
});
