import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@oppenheimer/backend-core';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialScopePort } from '../../application/credential-scope.port';
import { UsesBetterAuthSession } from '../../decorators/uses-better-auth-session.decorator';
import { AuthErrors } from '../../domain/auth.errors';
import type { ScopeContext } from '../../domain/scope-context.types';
import type { VerifiedSession } from '../../infrastructure/credential-verifier.port';
import type { DelegatedSessionPort } from '../../infrastructure/delegated-session.port';
import { ApiAuthGuard } from '../api-auth.guard';
import { OptionalApiAuthGuard } from '../optional-api-auth.guard';

const minute = 60 * 1000;

class PlainController {
  handle() {}
}

@UsesBetterAuthSession()
class FacadeController {
  handle() {}
}

function contextFor(
  request: object,
  controller: new () => { handle(): void } = PlainController,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => controller.prototype.handle,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

function sessionFor(user: Record<string, unknown>): VerifiedSession {
  return {
    session: { id: 'session-1', userId: 'user-1', activeOrganizationId: 'org-1' },
    user: {
      id: 'user-1',
      email: 'someone@example.com',
      isActive: true,
      banned: false,
      banExpires: null,
      ...user,
    },
  };
}

function fakeCredentials(): {
  [K in keyof CredentialScopePort]: ReturnType<typeof vi.fn>;
} {
  return {
    resolve: vi.fn().mockResolvedValue(null),
    resolveSession: vi.fn().mockResolvedValue(null),
    rateLimitKey: vi.fn(),
  };
}

const apiToken: ScopeContext = {
  kind: 'api-token',
  credentialId: 'token-1',
  userId: 'user-1',
  owner: {
    id: 'user-1',
    email: 'someone@example.com',
    firstName: 'Some',
    lastName: 'One',
    role: 'user',
    isActive: true,
    emailVerified: true,
  },
  scopes: ['organizations:read'],
  resourceScope: toResourceScope(['org-1']),
  expiresAt: null,
  prefix: 'oppenheimer_pat_abc',
};

describe('ApiAuthGuard, session path', () => {
  const tenants = { stamp: vi.fn() };
  let credentials: ReturnType<typeof fakeCredentials>;
  let guard: ApiAuthGuard;
  let request: Record<string, unknown>;

  beforeEach(() => {
    credentials = fakeCredentials();
    guard = new ApiAuthGuard(
      credentials as unknown as CredentialScopePort,
      {} as never,
      tenants as never,
      new Reflector(),
    );
    request = { headers: { cookie: 'session=abc' } };
  });

  it('admits a session whose account may act', async () => {
    credentials.resolveSession.mockResolvedValue(sessionFor({}));

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1' });
    expect(request.session).toMatchObject({ activeOrganizationId: 'org-1' });
  });

  it('refuses a missing session with AUTH_001', async () => {
    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      code: AuthErrors.UNAUTHENTICATED.code,
    });
  });

  it.each([
    ['a deactivated account', { isActive: false }],
    ['a ban with no expiry', { banned: true, banExpires: null }],
    ['a ban that has not expired', { banned: true, banExpires: new Date(Date.now() + minute) }],
  ])('refuses the session of %s exactly as it refuses no session', async (_label, user) => {
    // Regression: the session path never looked at the account's standing.
    const missing = await guard.canActivate(contextFor({ headers: {} })).catch((e) => e);

    credentials.resolveSession.mockResolvedValue(sessionFor(user));
    const refused = await guard.canActivate(contextFor(request)).catch((e) => e);

    expect(refused).toBeInstanceOf(AppError);
    expect(refused.code).toBe(AuthErrors.UNAUTHENTICATED.code);
    // Nothing in the response tells the caller the account is banned.
    expect(refused.detail).toBe(missing.detail);
    expect(request.user).toBeNull();
    expect(request.session).toBeNull();
  });

  it('admits a session whose ban has expired, before the plugin lifts it', async () => {
    credentials.resolveSession.mockResolvedValue(
      sessionFor({ banned: true, banExpires: new Date(Date.now() - minute) }),
    );

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1' });
  });
});

describe('ApiAuthGuard, scoped credential', () => {
  const tenants = { stamp: vi.fn() };
  let credentials: ReturnType<typeof fakeCredentials>;
  let delegatedSessions: { [K in keyof DelegatedSessionPort]: ReturnType<typeof vi.fn> };
  let guard: ApiAuthGuard;
  let request: { headers: Record<string, string>; [key: string]: unknown };

  beforeEach(() => {
    credentials = fakeCredentials();
    credentials.resolve.mockResolvedValue(apiToken);
    delegatedSessions = {
      resolveSessionToken: vi.fn().mockResolvedValue('delegated-token'),
      invalidate: vi.fn(),
      invalidateForUser: vi.fn(),
    };
    guard = new ApiAuthGuard(
      credentials as unknown as CredentialScopePort,
      delegatedSessions as unknown as DelegatedSessionPort,
      tenants as never,
      new Reflector(),
    );
    request = { headers: { authorization: 'Bearer oppenheimer_pat_abc' } };
  });

  it('mints no delegated session on a route that never calls Better Auth', async () => {
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(delegatedSessions.resolveSessionToken).not.toHaveBeenCalled();
    expect(request.headers.authorization).toBe('Bearer oppenheimer_pat_abc');
    expect(request.user).toMatchObject({ id: 'user-1' });
    expect(request.session).toEqual({ activeOrganizationId: 'org-1', activeTeamId: null });
    expect(credentials.resolveSession).not.toHaveBeenCalled();
  });

  it('presents a delegated session on a route marked @UsesBetterAuthSession()', async () => {
    await expect(guard.canActivate(contextFor(request, FacadeController))).resolves.toBe(true);

    expect(delegatedSessions.resolveSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialId: 'token-1',
        userId: 'user-1',
        activeOrganizationId: 'org-1',
      }),
    );
    expect(request.headers.authorization).toBe('Bearer delegated-token');
  });
});

describe('OptionalApiAuthGuard, session path', () => {
  it('treats a banned account as an anonymous caller', async () => {
    const tenants = { stamp: vi.fn() };
    const credentials = fakeCredentials();
    credentials.resolveSession.mockResolvedValue(sessionFor({ banned: true, banExpires: null }));
    const guard = new OptionalApiAuthGuard(
      credentials as unknown as CredentialScopePort,
      {} as never,
      tenants as never,
      new Reflector(),
    );
    const request: Record<string, unknown> = { headers: { cookie: 'session=abc' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toMatchObject({ user: null, session: null, scopeContext: null });
  });
});
