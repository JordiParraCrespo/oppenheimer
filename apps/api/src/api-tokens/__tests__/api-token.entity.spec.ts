import { describe, expect, it } from 'vitest';
import { ApiTokenEntity } from '../domain/api-token.entity';
import { API_TOKEN_PREFIX, hashApiTokenSecret } from '../domain/api-token.secret';
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

  it('treats an empty organization list as unrestricted', () => {
    expect(issue({ organizationIds: [] }).token.organizationIds).toBeNull();
    expect(issue().token.organizationIds).toBeNull();
  });

  it('de-duplicates a restricted organization list', () => {
    const { token } = issue({ organizationIds: ['org-b', 'org-a', 'org-b'] });
    expect(token.organizationIds).toEqual(['org-a', 'org-b']);
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
  it('is usable when fresh', () => {
    expect(issue().token.rejectionReason()).toBeNull();
  });

  it('reports expiry once the deadline passes', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token } = issue({ expiresInDays: 1, now });

    expect(token.rejectionReason({ now: new Date('2026-01-01T23:59:00Z') })).toBeNull();
    expect(token.rejectionReason({ now: new Date('2026-01-02T00:00:00Z') })).toBe('expired');
  });

  it('reports revocation ahead of expiry', () => {
    const { token } = issue();
    token.revoke();
    expect(token.isRevoked()).toBe(true);
    expect(token.rejectionReason()).toBe('revoked');
  });

  it('raises a domain event when revoked', () => {
    const { token } = issue();
    token.revoke();

    expect(token.domainEvents).toHaveLength(1);
    expect(token.domainEvents[0]).toBeInstanceOf(ApiTokenRevokedDomainEvent);
  });

  it('is idempotent on repeated revocation', () => {
    const { token } = issue();
    token.revoke(new Date('2026-01-01T00:00:00Z'));
    token.revoke(new Date('2026-06-01T00:00:00Z'));

    expect(token.revokedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(token.domainEvents).toHaveLength(1);
  });

  it('enforces its IP allowlist', () => {
    const { token } = issue({ ipAllowlist: ['203.0.113.0/24'] });

    expect(token.rejectionReason({ ipAddress: '203.0.113.9' })).toBeNull();
    expect(token.rejectionReason({ ipAddress: '198.51.100.4' })).toBe('ip-not-allowed');
    expect(token.rejectionReason({ ipAddress: null })).toBe('ip-not-allowed');
  });

  it('records when it was last used', () => {
    const { token } = issue();
    expect(token.lastUsedAt).toBeNull();

    const at = new Date('2026-03-03T10:00:00Z');
    token.markUsed(at);
    expect(token.lastUsedAt).toEqual(at);
  });
});

describe('ApiTokenEntity authorization', () => {
  it('grants a scope it carries', () => {
    expect(issue({ scopes: ['users:read'] }).token.grants(['users:read'])).toBe(true);
  });

  it('grants read through write on the same resource', () => {
    expect(issue({ scopes: ['users:write'] }).token.grants(['users:read'])).toBe(true);
  });

  it('does not grant write from read', () => {
    expect(issue({ scopes: ['users:read'] }).token.grants(['users:write'])).toBe(false);
  });

  it('requires every scope a route asks for', () => {
    const { token } = issue({ scopes: ['users:read'] });
    expect(token.grants(['users:read', 'roles:read'])).toBe(false);
  });

  it('allows any organization when unrestricted', () => {
    expect(issue().token.allowsOrganization('org-1')).toBe(true);
  });

  it('allows only its own organizations when restricted', () => {
    const { token } = issue({ organizationIds: ['org-1'] });
    expect(token.allowsOrganization('org-1')).toBe(true);
    expect(token.allowsOrganization('org-2')).toBe(false);
  });
});
