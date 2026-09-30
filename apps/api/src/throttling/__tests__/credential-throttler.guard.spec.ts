import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppError } from '@oppenheimer/backend-core';
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
 * property was undefined, the credential branch never fired, and the whole
 * website fleet quietly shared one IP bucket while the code looked correct.
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
    registry.registerAll([
      {
        kind: 'api-token',
        recognises: (presented) => presented.startsWith('oppenheimer_pat_'),
        resolve: apiTokenResolve as CredentialResolverPort['resolve'],
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

  it('keys a credential on whatever rateLimitKey returned, without looking it up', async () => {
    const { credentials } = guard as unknown as { credentials: CredentialScopeResolver };
    const rateLimitKey = vi.spyOn(credentials, 'rateLimitKey');
    const request = {
      ip: '1.2.3.4',
      headers: { authorization: 'Bearer oppenheimer_pat_secret123' },
    };

    const key = await tracker(request);

    expect(rateLimitKey).toHaveBeenCalledWith(request);
    expect(key).toBe(await rateLimitKey.mock.results[0]?.value);
    expectNoLookups();
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

  it('falls back to the IP for an anonymous caller', async () => {
    expect(await tracker({ ip: '1.2.3.4', headers: {} })).toBe('ip:1.2.3.4');
  });

  it('prefers a resolved user when one is present, over the IP', async () => {
    // Only populated when the guard is applied at route level, after auth.
    expect(await tracker({ ip: '1.2.3.4', headers: {}, user: { id: 'user-3' } })).toBe(
      'user:user-3',
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
    // Nest's own exception reaches the client with no `code`, so nothing can
    // tell a rate limit apart from any other 429.
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
