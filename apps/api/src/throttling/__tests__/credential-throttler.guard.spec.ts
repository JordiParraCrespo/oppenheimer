import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppError } from '@oppenheimer/backend-core';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthFailureLimiterPort } from '../../auth/application/auth-failure-limiter.port';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import type { CredentialResolverPort } from '../../auth/application/credential-resolver.port';
import { CredentialResolverRegistry } from '../../auth/application/credential-resolver.registry';
import { CredentialScopeResolver } from '../../auth/application/credential-scope.resolver';
import type { CredentialVerifierPort } from '../../auth/infrastructure/credential-verifier.port';
import { CredentialThrottlerGuard } from '../guards/credential-throttler.guard';

/**
 * The tracker decides which requests share a rate-limit bucket, and getting it
 * wrong is invisible: the limiter still works, it just limits the wrong set of
 * callers. That is exactly what happened before this suite existed — the guard
 * read `request.scopeContext`, which `ApiAuthGuard` populates, without
 * accounting for Nest running global guards *first*. On every real request that
 * property was undefined, the credential branch never fired, and every caller
 * behind one address quietly shared one IP bucket while the code looked correct.
 *
 * The guard runs against the real kernel resolver here, with every lookup it
 * could make spied on: deriving the bucket must cost no database and no
 * identity-provider call, or the limiter does its work before it limits.
 */
describe('CredentialThrottlerGuard', () => {
  let verifier: { [K in keyof CredentialVerifierPort]: ReturnType<typeof vi.fn> };
  let owners: { [K in keyof CredentialOwnerPort]: ReturnType<typeof vi.fn> };
  let registry: CredentialResolverRegistry;
  let failures: { [K in keyof AuthFailureLimiterPort]: ReturnType<typeof vi.fn> };
  let apiTokenResolve: ReturnType<typeof vi.fn>;
  let hostResolve: ReturnType<typeof vi.fn>;
  let guard: CredentialThrottlerGuard;

  const tracker = (req: Record<string, unknown>) =>
    (guard as unknown as { getTracker(r: Record<string, unknown>): Promise<string> }).getTracker(
      req,
    );

  beforeEach(() => {
    verifier = {
      verifyOAuthGrant: vi.fn(),
      verifySession: vi.fn(),
      signedSessionCookie: vi.fn(async (headers: Record<string, string>) =>
        headers.cookie === 'better-auth.session_token=signed' ? 'session-token-value' : null,
      ),
    };
    owners = { findActiveOwner: vi.fn(), requireActiveOwner: vi.fn() };
    failures = {
      recordFailure: vi.fn(),
      recordSuccess: vi.fn(),
      retryAfter: vi.fn().mockResolvedValue(0),
    };
    registry = new CredentialResolverRegistry();
    apiTokenResolve = vi.fn();
    hostResolve = vi.fn(async () => ({
      kind: 'host',
      credentialId: 'host:host-1',
      hostId: 'host-1',
      scopes: [],
      resourceScope: toResourceScope(null),
      expiresAt: null,
    }));
    registry.registerAll([
      {
        kind: 'api-token',
        recognises: (presented) => presented.startsWith('oppenheimer_pat_'),
        resolve: apiTokenResolve as CredentialResolverPort['resolve'],
      },
      {
        kind: 'host',
        singleUse: true,
        recognises: (presented) => presented.startsWith('eyJ'),
        resolve: hostResolve as CredentialResolverPort['resolve'],
      },
    ]);

    guard = new CredentialThrottlerGuard({ throttlers: [] } as never, {} as never, {} as never);
    // Property-injected in production; set directly here.
    Object.assign(guard, {
      credentials: new CredentialScopeResolver(
        registry,
        verifier as unknown as CredentialVerifierPort,
        owners as unknown as CredentialOwnerPort,
        failures as unknown as AuthFailureLimiterPort,
      ),
      failures,
    });
  });

  const expectNoLookups = () => {
    expect(apiTokenResolve).not.toHaveBeenCalled();
    expect(verifier.verifyOAuthGrant).not.toHaveBeenCalled();
    expect(verifier.verifySession).not.toHaveBeenCalled();
    expect(owners.findActiveOwner).not.toHaveBeenCalled();
    expect(owners.requireActiveOwner).not.toHaveBeenCalled();
  };

  it('keys an API token on a digest of the secret, without looking it up', async () => {
    const key = await tracker({
      ip: '1.2.3.4',
      headers: { authorization: 'Bearer oppenheimer_pat_secret123' },
    });

    expect(key).toMatch(/^cred:[0-9a-f]{32}$/);
    expect(key).not.toContain('secret123');
    expectNoLookups();
  });

  it('keys an opaque bearer (OAuth or session token) the same way', async () => {
    const key = await tracker({ ip: '1.2.3.4', headers: { authorization: 'Bearer opaque-xyz' } });

    expect(key).toMatch(/^cred:[0-9a-f]{32}$/);
    expect(key).not.toContain('opaque-xyz');
    expectNoLookups();
  });

  it('keys a signed-in browser on its session cookie, not on its office’s IP', async () => {
    const key = await tracker({
      ip: '1.2.3.4',
      headers: { cookie: 'better-auth.session_token=signed' },
    });

    expect(key).toMatch(/^session:[0-9a-f]{32}$/);
    expect(key).not.toContain('session-token-value');
    expectNoLookups();
  });

  it('keys a forged cookie on the IP: an unsigned cookie opens no bucket', async () => {
    expect(
      await tracker({ ip: '1.2.3.4', headers: { cookie: 'better-auth.session_token=forged' } }),
    ).toBe('ip:1.2.3.4');
  });

  it('gives one credential one bucket regardless of what the body claims', async () => {
    // The site is attacker-controlled body content. Including it in the key
    // would let a caller mint an unlimited number of buckets by rotating
    // hostnames and walk straight past the documented limit.
    const headers = { authorization: 'Bearer oppenheimer_pat_one' };

    const first = await tracker({ ip: '1.2.3.4', headers, body: { siteDomain: 'a.com' } });
    const second = await tracker({ ip: '1.2.3.4', headers, body: { siteDomain: 'b.com' } });

    expect(first).toBe(second);
  });

  it('does not let the whole fleet share one bucket just because it shares an egress IP', async () => {
    const one = await tracker({
      ip: '9.9.9.9',
      headers: { authorization: 'Bearer oppenheimer_pat_a' },
    });
    const two = await tracker({
      ip: '9.9.9.9',
      headers: { authorization: 'Bearer oppenheimer_pat_b' },
    });

    expect(one).not.toBe(two);
  });

  it('buckets a host by the host its single-use assertion resolves to', async () => {
    const first = await tracker({ ip: '1.2.3.4', headers: { authorization: 'Bearer eyJone' } });
    const second = await tracker({ ip: '1.2.3.4', headers: { authorization: 'Bearer eyJtwo' } });

    expect(first).toBe('cred:host:host-1');
    expect(second).toBe(first);
  });

  it('falls back to the IP for an anonymous caller', async () => {
    expect(await tracker({ ip: '1.2.3.4', headers: {} })).toBe('ip:1.2.3.4');
  });

  it('prefers a resolved user when one is present, over the IP', async () => {
    expect(await tracker({ ip: '1.2.3.4', headers: {}, user: { id: 'user-3' } })).toBe(
      'user:user-3',
    );
  });

  it('treats a refused single-use credential as anonymous instead of throwing', async () => {
    hostResolve.mockRejectedValue(new Error('replayed'));

    expect(await tracker({ ip: '1.2.3.4', headers: { authorization: 'Bearer eyJold' } })).toBe(
      'ip:1.2.3.4',
    );
  });

  describe('the auth-failure budget', () => {
    const contextFor = (request: object) =>
      ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;
    const handle = (request: object) =>
      (
        guard as unknown as {
          handleRequest(props: { context: ExecutionContext }): Promise<boolean>;
        }
      ).handleRequest({ context: contextFor(request) });

    beforeEach(() => {
      vi.spyOn(
        ThrottlerGuard.prototype as unknown as { handleRequest(): Promise<boolean> },
        'handleRequest',
      ).mockResolvedValue(true);
    });

    it('refuses a bearer from an address past its budget with RATE_001, before any lookup', async () => {
      failures.retryAfter.mockResolvedValue(45);
      const request = { ip: '6.6.6.6', headers: { authorization: 'Bearer made-up-string' } };

      const error = await handle(request).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('RATE_001');
      expect((error as AppError).extensions).toEqual({ retryAfter: 45 });
      expect(failures.retryAfter).toHaveBeenCalledWith(
        '6.6.6.6',
        expect.stringMatching(/^cred:[0-9a-f]{32}$/),
      );
      expectNoLookups();
    });

    it('lets a bearer through to the ordinary limit while the address is within budget', async () => {
      await expect(
        handle({ ip: '6.6.6.6', headers: { authorization: 'Bearer oppenheimer_pat_ok' } }),
      ).resolves.toBe(true);
    });

    it('never holds a browser or an anonymous caller to it', async () => {
      failures.retryAfter.mockResolvedValue(45);

      await expect(handle({ ip: '6.6.6.6', headers: {} })).resolves.toBe(true);
      await expect(
        handle({ ip: '6.6.6.6', headers: { cookie: 'better-auth.session_token=signed' } }),
      ).resolves.toBe(true);
      expect(failures.retryAfter).not.toHaveBeenCalled();
    });
  });
});

describe('CredentialThrottlerGuard – a blocked request', () => {
  it('answers with the RATE_001 catalog error, not a codeless ThrottlerException', async () => {
    const guard = new CredentialThrottlerGuard(
      { throttlers: [] } as never,
      {} as never,
      {} as never,
    ) as unknown as {
      throwThrottlingException(
        context: unknown,
        limit: { timeToBlockExpire: number },
      ): Promise<void>;
    };

    const error = await guard
      .throwThrottlingException({}, { timeToBlockExpire: 42 })
      .catch((e: unknown) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('RATE_001');
    expect((error as AppError).getStatus()).toBe(429);
    expect((error as AppError).extensions).toEqual({ retryAfter: 42 });
  });
});
