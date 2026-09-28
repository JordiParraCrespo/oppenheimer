import type { ExecutionContext } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthErrors } from '../../domain/auth.errors';
import { ApiAuthGuard } from '../api-auth.guard';
import { OptionalApiAuthGuard } from '../optional-api-auth.guard';

function contextFor(request: object): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

const tenants = { stamp: vi.fn().mockReturnValue({ organizationId: null }) };

describe('OptionalApiAuthGuard', () => {
  let guard: OptionalApiAuthGuard;

  beforeEach(() => {
    guard = new OptionalApiAuthGuard({} as never, {} as never, tenants as never, {} as never);
  });

  it('lets an anonymous caller through with no identity', async () => {
    vi.spyOn(ApiAuthGuard.prototype, 'canActivate').mockRejectedValue(
      new AppError(AuthErrors.UNAUTHENTICATED),
    );
    const request: Record<string, unknown> = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toMatchObject({ user: null, session: null, scopeContext: null });
    // An anonymous caller still acts in the organization a route names.
    expect(tenants.stamp).toHaveBeenCalledWith(expect.anything(), request);
  });

  it('still refuses a credential that was presented and is broken', async () => {
    const broken = new AppError({ code: 'TOKEN_003', message: 'Invalid token', httpStatus: 401 });
    vi.spyOn(ApiAuthGuard.prototype, 'canActivate').mockRejectedValue(broken);

    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBe(broken);
  });

  it('passes an authenticated caller straight through', async () => {
    vi.spyOn(ApiAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
  });
});
