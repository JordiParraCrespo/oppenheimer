import { Logger } from '@nestjs/common';
import { toResourceScope } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialOwnerPort } from '../../../auth/application/credential-owner.port';
import type { CredentialOwner, ScopedRequest } from '../../../auth/domain/scope-context.types';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';
import { ApiTokenEntity } from '../../domain/api-token.entity';
import { hashApiTokenSecret } from '../../domain/api-token-secret.factory';
import { ApiTokenCredentialResolver } from '../api-token-credential.resolver';

const owner: CredentialOwner = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Owner',
  lastName: 'Example',
  role: 'user',
  isActive: true,
  emailVerified: true,
};

const request = (ip = '203.0.113.7') => ({ headers: {}, ip }) as ScopedRequest;

describe('ApiTokenCredentialResolver', () => {
  let apiTokens: ApiTokenRepositoryPort;
  let owners: CredentialOwnerPort;
  let resolver: ApiTokenCredentialResolver;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    apiTokens = {
      findOneByHash: vi.fn(),
      touchLastUsedAt: vi.fn().mockResolvedValue(undefined),
    } as unknown as ApiTokenRepositoryPort;
    owners = { findActiveOwner: vi.fn().mockResolvedValue(owner) };
    resolver = new ApiTokenCredentialResolver(apiTokens, owners);
  });

  const stored = (overrides: Partial<Parameters<typeof ApiTokenEntity.issue>[0]> = {}) => {
    const { token, secret } = ApiTokenEntity.issue({
      userId: owner.id,
      name: 'CI deploy',
      scopes: ['users:read'],
      ...overrides,
    });
    vi.mocked(apiTokens.findOneByHash).mockResolvedValue(Some(token));
    return { token, secret };
  };

  it('claims the secrets this module mints, and nothing else', () => {
    const { secret } = ApiTokenEntity.issue({
      userId: owner.id,
      name: 'CI',
      scopes: ['users:read'],
    });

    expect(resolver.recognises(secret)).toBe(true);
    expect(resolver.recognises('oauth-access-token')).toBe(false);
    expect(resolver.kind).toBe('api-token');
  });

  it('resolves a live token by the digest of the presented secret', async () => {
    const { token, secret } = stored({ organizationIds: ['org-1'] });

    const scope = await resolver.resolve(secret, request());

    expect(apiTokens.findOneByHash).toHaveBeenCalledWith(hashApiTokenSecret(secret));
    expect(scope).toMatchObject({
      kind: 'api-token',
      credentialId: token.id,
      userId: owner.id,
      owner,
      scopes: ['users:read'],
      prefix: token.prefix,
    });
    expect(scope.resourceScope).toEqual(toResourceScope(['org-1']));
  });

  it('records the usage without letting a failed stamp fail the request', async () => {
    const { token, secret } = stored();
    vi.mocked(apiTokens.touchLastUsedAt).mockRejectedValue(new Error('write failed'));

    await expect(resolver.resolve(secret, request())).resolves.toMatchObject({
      credentialId: token.id,
    });
    expect(apiTokens.touchLastUsedAt).toHaveBeenCalledWith(token.id, expect.any(Date));
  });

  it('refuses an unknown digest with the opaque credential error', async () => {
    vi.mocked(apiTokens.findOneByHash).mockResolvedValue(None);

    await expect(resolver.resolve('oppenheimer_pat_unknown', request())).rejects.toMatchObject({
      code: 'TOKEN_003',
    });
  });

  it('refuses a revoked token with the same error as an unknown one', async () => {
    const { token, secret } = stored();
    token.revoke();

    await expect(resolver.resolve(secret, request())).rejects.toMatchObject({ code: 'TOKEN_003' });
  });

  it('refuses an expired token with the same error as an unknown one', async () => {
    const { secret } = stored({
      expiresInDays: 1,
      now: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    await expect(resolver.resolve(secret, request())).rejects.toMatchObject({ code: 'TOKEN_003' });
  });

  it('names the reason when the address is outside the token’s allowlist', async () => {
    const { secret } = stored({ ipAllowlist: ['198.51.100.0/24'] });

    await expect(resolver.resolve(secret, request('203.0.113.7'))).rejects.toMatchObject({
      code: 'TOKEN_004',
    });
  });

  it('falls back to the socket address when the request has no ip', async () => {
    const { secret } = stored({ ipAllowlist: ['198.51.100.7'] });
    const fromSocket = { headers: {}, socket: { remoteAddress: '198.51.100.7' } } as ScopedRequest;

    await expect(resolver.resolve(secret, fromSocket)).resolves.toMatchObject({
      kind: 'api-token',
    });
  });

  it('refuses a token whose owner can no longer act', async () => {
    const { secret } = stored();
    vi.mocked(owners.findActiveOwner).mockResolvedValue(null);

    await expect(resolver.resolve(secret, request())).rejects.toMatchObject({ code: 'TOKEN_003' });
  });
});
