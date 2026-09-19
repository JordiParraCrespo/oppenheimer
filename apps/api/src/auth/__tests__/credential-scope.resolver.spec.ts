import { None } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiTokenRepositoryPort } from '../../api-tokens/database/api-token.repository.port';
import type { HostAssertionPort } from '../../hosts/application/host-assertion.port';
import type { UserRepositoryPort } from '../../users/database/user.repository.port';
import { CredentialScopeResolver } from '../application/credential-scope.resolver';
import type { ScopedRequest } from '../domain/scope-context.types';
import type { CredentialVerifierPort } from '../infrastructure/credential-verifier.port';

/**
 * The fourth credential kind.
 *
 * What matters here is the routing, not the cryptography — the assertion itself
 * is `hosts/application/__tests__/host-assertion.resolver.spec.ts`. A bearer that
 * is a host's assertion must reach the hosts module and nothing else, and every
 * other kind must keep reaching what it reached before.
 */

/** A compact JWS header/payload/signature, shaped like a boot assertion. */
const HOST_ASSERTION = [
  Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ iss: 'host-1', sub: 'host-1' })).toString('base64url'),
  Buffer.from('signature-bytes').toString('base64url'),
].join('.');

describe('CredentialScopeResolver', () => {
  let apiTokens: Pick<ApiTokenRepositoryPort, 'findOneByHash' | 'touchLastUsedAt'>;
  let users: Pick<UserRepositoryPort, 'findOneById'>;
  let verifier: Pick<CredentialVerifierPort, 'verifyOAuthGrant' | 'hasValidSession'>;
  let hostAssertions: HostAssertionPort;
  let resolver: CredentialScopeResolver;

  const request = (authorization?: string): ScopedRequest => ({
    headers: authorization ? { authorization } : {},
  });

  beforeEach(() => {
    apiTokens = {
      findOneByHash: vi.fn().mockResolvedValue(None),
      touchLastUsedAt: vi.fn().mockResolvedValue(undefined),
    };
    users = { findOneById: vi.fn().mockResolvedValue(None) };
    verifier = {
      verifyOAuthGrant: vi.fn().mockResolvedValue(null),
      hasValidSession: vi.fn().mockResolvedValue(false),
    };
    hostAssertions = {
      // Only the shape decides whether this module is asked; verification is its
      // own business.
      recognises: vi.fn((bearer: string) => bearer === HOST_ASSERTION),
      verify: vi.fn().mockResolvedValue({ hostId: 'host-1' }),
    };

    resolver = new CredentialScopeResolver(
      apiTokens as ApiTokenRepositoryPort,
      users as UserRepositoryPort,
      verifier as CredentialVerifierPort,
      hostAssertions,
    );
  });

  it('marks a verified host assertion on the request and yields no scope context', async () => {
    const target = request(`Bearer ${HOST_ASSERTION}`);

    // `null` is deliberate: a host has no owner to act as and no scopes to
    // narrow, so a `ScopeContext` would be a credential with an empty middle.
    await expect(resolver.resolve(target)).resolves.toBeNull();
    expect(target.hostPrincipal).toEqual({ hostId: 'host-1' });
    expect(target.user).toBeUndefined();
  });

  it('does not fall back to a session lookup for a host', async () => {
    await resolver.resolve(request(`Bearer ${HOST_ASSERTION}`));

    expect(verifier.hasValidSession).not.toHaveBeenCalled();
    expect(verifier.verifyOAuthGrant).not.toHaveBeenCalled();
  });

  it('lets a refused assertion refuse the request', async () => {
    hostAssertions.verify = vi.fn().mockRejectedValue(new Error('rejected'));

    await expect(resolver.resolve(request(`Bearer ${HOST_ASSERTION}`))).rejects.toThrow('rejected');
  });

  it('still rejects an unrecognisable bearer', async () => {
    // The host path must not become a way past `rejectUnlessSession`.
    await expect(resolver.resolve(request('Bearer not-a-credential'))).rejects.toMatchObject({
      code: 'TOKEN_003',
    });
  });

  it('leaves a request with no credential alone', async () => {
    const target = request();

    await expect(resolver.resolve(target)).resolves.toBeNull();
    expect(hostAssertions.recognises).not.toHaveBeenCalled();
    expect(target.hostPrincipal).toBeUndefined();
  });

  it('never asks the hosts module about an API token', async () => {
    await resolver.resolve(request('Bearer oppenheimer_pat_abc')).catch(() => undefined);

    expect(hostAssertions.recognises).not.toHaveBeenCalled();
    expect(apiTokens.findOneByHash).toHaveBeenCalled();
  });

  it('resolves once per request', async () => {
    const target = request(`Bearer ${HOST_ASSERTION}`);

    await resolver.resolve(target);
    await resolver.resolve(target);

    // Memoized, because three guards ask and verification burns a `jti`: a second
    // verification of the same assertion would refuse itself as a replay.
    expect(hostAssertions.verify).toHaveBeenCalledTimes(1);
  });
});
