import { AppError } from '@oppenheimer/backend-core';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthErrors } from '../../domain/auth.errors';
import type {
  CredentialOwner,
  ScopeContext,
  ScopedRequest,
} from '../../domain/scope-context.types';
import type {
  CredentialVerifierPort,
  VerifiedSession,
} from '../../infrastructure/credential-verifier.port';
import type { AuthFailureLimiterPort } from '../auth-failure-limiter.port';
import type { CredentialOwnerPort } from '../credential-owner.port';
import type { CredentialResolverPort } from '../credential-resolver.port';
import { CredentialResolverRegistry } from '../credential-resolver.registry';
import { CredentialScopeResolver } from '../credential-scope.resolver';

const owner: CredentialOwner = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Owner',
  lastName: 'Example',
  role: 'user',
  isActive: true,
  emailVerified: true,
};

const verifiedSession: VerifiedSession = {
  session: { id: 'session-1', userId: owner.id, activeOrganizationId: 'org-1' },
  user: { id: owner.id, email: owner.email },
};

const requestWith = (authorization?: string): ScopedRequest =>
  ({ headers: authorization ? { authorization } : {}, ip: '203.0.113.7' }) as ScopedRequest;

describe('CredentialScopeResolver', () => {
  let registry: CredentialResolverRegistry;
  let credentials: CredentialVerifierPort;
  let owners: CredentialOwnerPort;
  let failures: AuthFailureLimiterPort;
  let resolver: CredentialScopeResolver;

  beforeEach(() => {
    registry = new CredentialResolverRegistry();
    credentials = {
      verifyOAuthGrant: vi.fn().mockResolvedValue(null),
      verifySession: vi.fn().mockResolvedValue(null),
      signedSessionCookie: vi.fn().mockResolvedValue(null),
    };
    owners = {
      findActiveOwner: vi.fn().mockResolvedValue(owner),
      requireActiveOwner: vi.fn().mockResolvedValue(owner),
    };
    failures = { recordFailure: vi.fn(), recordSuccess: vi.fn(), retryAfter: vi.fn() };
    resolver = new CredentialScopeResolver(registry, credentials, owners, failures);
  });

  /** A contribution, as `AuthModule.contributeCredentials` registers it. */
  const contribute = (overrides: Partial<CredentialResolverPort> = {}) => {
    const contributed: CredentialResolverPort = {
      kind: 'test-credential',
      recognises: (presented) => presented.startsWith('test_'),
      resolve: vi.fn(
        async (): Promise<ScopeContext> => ({
          kind: 'test-credential',
          credentialId: 'credential-1',
          userId: owner.id,
          owner,
          scopes: ['users:read'],
          resourceScope: toResourceScope(null),
          expiresAt: null,
        }),
      ),
      ...overrides,
    };
    registry.register(contributed);
    return contributed;
  };

  it('has no credential to resolve when the request carries none', async () => {
    await expect(resolver.resolve(requestWith())).resolves.toBeNull();
    expect(credentials.verifyOAuthGrant).not.toHaveBeenCalled();
    // Nor does it look the cookie up: most callers of `resolve` only want the scope.
    expect(credentials.verifySession).not.toHaveBeenCalled();
  });

  it('uses the registered resolver that recognises the presented credential', async () => {
    const contributed = contribute();
    const request = requestWith('Bearer test_abc');

    await expect(resolver.resolve(request)).resolves.toMatchObject({
      kind: 'test-credential',
      credentialId: 'credential-1',
    });
    expect(contributed.resolve).toHaveBeenCalledWith('test_abc', request);
    // The kernel never asks the identity provider about a claimed credential.
    expect(credentials.verifyOAuthGrant).not.toHaveBeenCalled();
  });

  it('lets a recognising resolver refuse: the credential never falls through', async () => {
    contribute({
      resolve: vi.fn().mockRejectedValue(new Error('revoked')),
    });

    await expect(resolver.resolve(requestWith('Bearer test_abc'))).rejects.toThrow('revoked');
    expect(credentials.verifySession).not.toHaveBeenCalled();
  });

  it('reads an API key header the same way as a bearer credential', async () => {
    const contributed = contribute();
    const request = { headers: { 'x-api-key': ' test_abc ' } } as unknown as ScopedRequest;

    await expect(resolver.resolve(request)).resolves.toMatchObject({ kind: 'test-credential' });
    expect(contributed.resolve).toHaveBeenCalledWith('test_abc', request);
  });

  it('resolves an OAuth grant itself, with the owner as they are now', async () => {
    vi.mocked(credentials.verifyOAuthGrant).mockResolvedValue({
      userId: owner.id,
      accessToken: 'oauth-access-token',
      scopes: 'users:read users:write',
      accessTokenExpiresAt: '2026-01-01T00:00:00.000Z',
    });

    const scope = await resolver.resolve(requestWith('Bearer oauth-access-token'));

    expect(scope).toMatchObject({ kind: 'oauth', userId: owner.id, owner });
    expect(scope?.scopes).toContain('users:read');
    expect(scope?.credentialId.startsWith('oauth:')).toBe(true);
    expect(scope?.credentialId).not.toContain('oauth-access-token');
    expect(scope?.expiresAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(credentials.verifyOAuthGrant).toHaveBeenCalledTimes(1);
    expect(credentials.verifySession).not.toHaveBeenCalled();
  });

  it('refuses an OAuth grant whose owner is deactivated or banned', async () => {
    // The owner port refuses any account `isAccessAllowed` refuses (see
    // `UserCredentialOwnerAdapter`); a banned owner's MCP client gets the same
    // opaque TOKEN_003 as a deactivated one's.
    vi.mocked(credentials.verifyOAuthGrant).mockResolvedValue({
      userId: owner.id,
      accessToken: 'oauth-access-token',
      scopes: 'users:read',
      accessTokenExpiresAt: null,
    });
    vi.mocked(owners.requireActiveOwner).mockRejectedValue(
      new AppError(AuthErrors.INVALID_CREDENTIAL),
    );

    await expect(resolver.resolve(requestWith('Bearer oauth-access-token'))).rejects.toMatchObject({
      code: 'TOKEN_003',
    });
  });

  it('hands a session token presented as a bearer back to the session path', async () => {
    vi.mocked(credentials.verifySession).mockResolvedValue(verifiedSession);

    await expect(resolver.resolve(requestWith('Bearer session-token'))).resolves.toBeNull();
  });

  it('verifies a bearer session exactly once per request, however it is asked', async () => {
    // Regression: the session was verified to rule out a stray bearer, the
    // answer thrown away, and `ApiAuthGuard` verified it again — three lookups
    // for one request.
    vi.mocked(credentials.verifySession).mockResolvedValue(verifiedSession);
    const request = requestWith('Bearer session-token');

    await resolver.resolve(request);
    await expect(resolver.resolveSession(request)).resolves.toBe(verifiedSession);
    await resolver.resolve(request);
    await resolver.resolveSession(request);

    expect(credentials.verifyOAuthGrant).toHaveBeenCalledTimes(1);
    expect(credentials.verifySession).toHaveBeenCalledTimes(1);
  });

  it('looks a cookie session up only when asked, and only once', async () => {
    vi.mocked(credentials.verifySession).mockResolvedValue(verifiedSession);
    const request = requestWith();

    await expect(
      Promise.all([resolver.resolveSession(request), resolver.resolveSession(request)]),
    ).resolves.toEqual([verifiedSession, verifiedSession]);

    expect(credentials.verifySession).toHaveBeenCalledTimes(1);
    expect(credentials.verifyOAuthGrant).not.toHaveBeenCalled();
  });

  it('has no session for a scoped credential', async () => {
    contribute();

    await expect(resolver.resolveSession(requestWith('Bearer test_abc'))).resolves.toBeNull();
    expect(credentials.verifySession).not.toHaveBeenCalled();
  });

  it('rejects a bearer nothing recognises rather than falling back to the session', async () => {
    contribute();

    const refusal = resolver.resolve(requestWith('Bearer not-a-known-credential'));

    await expect(refusal).rejects.toBeInstanceOf(AppError);
    await expect(refusal).rejects.toMatchObject({ code: 'TOKEN_003' });
  });

  it('resolves once per request, however many guards ask', async () => {
    const contributed = contribute();
    const request = requestWith('Bearer test_abc');

    await Promise.all([resolver.resolve(request), resolver.resolve(request)]);
    await resolver.resolve(request);

    expect(contributed.resolve).toHaveBeenCalledTimes(1);
  });

  describe('the auth-failure budget', () => {
    it('counts a refused credential against its source address', async () => {
      await expect(resolver.resolve(requestWith('Bearer made-up'))).rejects.toMatchObject({
        code: 'TOKEN_003',
      });

      expect(failures.recordFailure).toHaveBeenCalledWith('203.0.113.7');
      expect(failures.recordSuccess).not.toHaveBeenCalled();
    });

    it('vouches for an accepted credential under its rate-limit key', async () => {
      contribute();
      const request = requestWith('Bearer test_abc');

      await resolver.resolve(request);

      expect(failures.recordSuccess).toHaveBeenCalledWith(await resolver.rateLimitKey(request));
      expect(failures.recordFailure).not.toHaveBeenCalled();
    });

    it('does not count a refusal that is not about the credential', async () => {
      contribute({ resolve: vi.fn().mockRejectedValue(new Error('database down')) });

      await expect(resolver.resolve(requestWith('Bearer test_abc'))).rejects.toThrow();
      expect(failures.recordFailure).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitKey', () => {
    it('buckets a presented secret by its digest, without verifying it', async () => {
      contribute();
      const first = await resolver.rateLimitKey(requestWith('Bearer test_secret-value'));
      const again = await resolver.rateLimitKey(requestWith('Bearer test_secret-value'));
      const other = await resolver.rateLimitKey(requestWith('Bearer test_other-value'));

      expect(first).toMatch(/^cred:[0-9a-f]{32}$/);
      expect(again).toBe(first);
      expect(other).not.toBe(first);
      expect(first).not.toContain('secret-value');
      expect(registry.all()[0].resolve).not.toHaveBeenCalled();
      expect(credentials.verifyOAuthGrant).not.toHaveBeenCalled();
      expect(credentials.verifySession).not.toHaveBeenCalled();
    });

    it('buckets an opaque bearer and an API key header alike', async () => {
      const bearer = await resolver.rateLimitKey(requestWith('Bearer opaque'));
      const header = await resolver.rateLimitKey({
        headers: { 'x-api-key': 'opaque' },
      } as unknown as ScopedRequest);

      // A credential no contribution recognises still gets its own bucket:
      // `null` would drop it to the IP bucket (two nulls also compare equal).
      expect(bearer).toMatch(/^cred:[0-9a-f]{32}$/);
      expect(bearer).not.toContain('opaque');
      expect(bearer).toBe(header);
      expect(credentials.verifyOAuthGrant).not.toHaveBeenCalled();
    });

    it('buckets a signed session cookie by its digest', async () => {
      const token = 'session-token-value';
      vi.mocked(credentials.signedSessionCookie).mockResolvedValue(token);

      const key = await resolver.rateLimitKey(requestWith());

      expect(key).toMatch(/^session:[0-9a-f]{32}$/);
      expect(key).not.toContain(token);
      expect(credentials.verifySession).not.toHaveBeenCalled();
    });

    it('has no bucket for a caller with no credential and no signed cookie', async () => {
      await expect(resolver.rateLimitKey(requestWith())).resolves.toBeNull();
    });

    it('resolves a single-use kind and buckets it by what it resolved to', async () => {
      const contributed = contribute({
        singleUse: true,
        resolve: vi.fn(
          async (): Promise<ScopeContext> => ({
            kind: 'host',
            credentialId: 'host:host-1',
            hostId: 'host-1',
            scopes: [],
            resourceScope: toResourceScope(null),
            expiresAt: null,
          }),
        ),
      });
      const request = requestWith('Bearer test_assertion');

      await expect(resolver.rateLimitKey(request)).resolves.toBe('cred:host:host-1');
      // The guard that authenticates the request reuses the same resolution:
      // the single-use string is burned once.
      await resolver.resolve(request);
      expect(contributed.resolve).toHaveBeenCalledTimes(1);
    });

    it('falls back to no bucket when a single-use credential is refused', async () => {
      contribute({ singleUse: true, resolve: vi.fn().mockRejectedValue(new Error('replayed')) });

      await expect(resolver.rateLimitKey(requestWith('Bearer test_assertion'))).resolves.toBeNull();
    });
  });
});
