import { AppError } from '@oppenheimer/backend-core';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CredentialOwner,
  ScopeContext,
  ScopedRequest,
} from '../../domain/scope-context.types';
import type { CredentialVerifierPort } from '../../infrastructure/credential-verifier.port';
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

const requestWith = (authorization?: string): ScopedRequest =>
  ({ headers: authorization ? { authorization } : {} }) as ScopedRequest;

describe('CredentialScopeResolver', () => {
  let registry: CredentialResolverRegistry;
  let credentials: CredentialVerifierPort;
  let owners: CredentialOwnerPort;
  let resolver: CredentialScopeResolver;

  beforeEach(() => {
    registry = new CredentialResolverRegistry();
    credentials = {
      verifyOAuthGrant: vi.fn().mockResolvedValue(null),
      hasValidSession: vi.fn().mockResolvedValue(false),
    };
    owners = { findActiveOwner: vi.fn().mockResolvedValue(owner) };
    resolver = new CredentialScopeResolver(registry, credentials, owners);
  });

  /** A contribution, as a feature module registers it through `forFeature`. */
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
    expect(credentials.hasValidSession).not.toHaveBeenCalled();
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
    // The id is a digest of the token, never the token itself.
    expect(scope?.credentialId.startsWith('oauth:')).toBe(true);
    expect(scope?.credentialId).not.toContain('oauth-access-token');
    expect(scope?.expiresAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('refuses an OAuth grant whose owner can no longer act', async () => {
    vi.mocked(credentials.verifyOAuthGrant).mockResolvedValue({
      userId: owner.id,
      accessToken: 'oauth-access-token',
      scopes: 'users:read',
      accessTokenExpiresAt: null,
    });
    vi.mocked(owners.findActiveOwner).mockResolvedValue(null);

    await expect(resolver.resolve(requestWith('Bearer oauth-access-token'))).rejects.toMatchObject({
      code: 'TOKEN_003',
    });
  });

  it('hands a session token presented as a bearer back to the session path', async () => {
    vi.mocked(credentials.hasValidSession).mockResolvedValue(true);

    await expect(resolver.resolve(requestWith('Bearer session-token'))).resolves.toBeNull();
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
});
