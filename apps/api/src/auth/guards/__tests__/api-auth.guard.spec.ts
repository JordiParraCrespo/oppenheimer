import type { ExecutionContext } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real config opens a Postgres pool at import time.
vi.mock('../../infrastructure/better-auth.config', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { AuthErrors } from '../../domain/auth.errors';
import { auth } from '../../infrastructure/better-auth.config';
import { ApiAuthGuard } from '../api-auth.guard';
import { OptionalApiAuthGuard } from '../optional-api-auth.guard';

const getSession = vi.mocked(auth.api.getSession);
const minute = 60 * 1000;

function contextFor(request: object): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function sessionFor(user: Record<string, unknown>) {
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
  } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>;
}

describe('ApiAuthGuard, session path', () => {
  // No scoped credential presented: the guard falls through to the session.
  const credentials = { resolve: vi.fn().mockResolvedValue(null) };
  const tenants = { stamp: vi.fn() };
  let guard: ApiAuthGuard;
  let request: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new ApiAuthGuard(credentials as never, {} as never, tenants as never);
    request = { headers: { cookie: 'session=abc' } };
  });

  it('admits a session whose account may act', async () => {
    getSession.mockResolvedValue(sessionFor({}));

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1' });
    expect(request.session).toMatchObject({ activeOrganizationId: 'org-1' });
  });

  it('refuses a missing session with AUTH_001', async () => {
    getSession.mockResolvedValue(null);

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
    getSession.mockResolvedValue(null);
    const missing = await guard.canActivate(contextFor({ headers: {} })).catch((e) => e);

    getSession.mockResolvedValue(sessionFor(user));
    const refused = await guard.canActivate(contextFor(request)).catch((e) => e);

    expect(refused).toBeInstanceOf(AppError);
    expect(refused.code).toBe(AuthErrors.UNAUTHENTICATED.code);
    // Nothing in the response tells the caller the account is banned.
    expect(refused.detail).toBe(missing.detail);
    expect(request.user).toBeNull();
    expect(request.session).toBeNull();
  });

  it('admits a session whose ban has expired, before the plugin lifts it', async () => {
    getSession.mockResolvedValue(
      sessionFor({ banned: true, banExpires: new Date(Date.now() - minute) }),
    );

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1' });
  });
});

describe('OptionalApiAuthGuard, session path', () => {
  it('treats a banned account as an anonymous caller', async () => {
    const tenants = { stamp: vi.fn() };
    const guard = new OptionalApiAuthGuard(
      { resolve: vi.fn().mockResolvedValue(null) } as never,
      {} as never,
      tenants as never,
    );
    getSession.mockResolvedValue(sessionFor({ banned: true, banExpires: null }));
    const request: Record<string, unknown> = { headers: { cookie: 'session=abc' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toMatchObject({ user: null, session: null, scopeContext: null });
  });
});
