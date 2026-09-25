import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { FlagEvaluatorPort } from '../application/flag-evaluator.port';
import { FeatureFlagErrors } from '../domain/feature-flags.errors';
import { FeatureFlagGuard, REQUIRE_FLAG_KEY } from '../guards/feature-flag.guard';

function contextFor(handler: () => void, request: object): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardWith(enabled: boolean) {
  const evaluator = { isEnabled: vi.fn().mockReturnValue(enabled) };
  return {
    guard: new FeatureFlagGuard(new Reflector(), evaluator as unknown as FlagEvaluatorPort),
    evaluator,
  };
}

describe('FeatureFlagGuard', () => {
  const gated = () => {};
  Reflect.defineMetadata(REQUIRE_FLAG_KEY, 'api_token_creation', gated);

  it('lets an ungated route through without evaluating anything', () => {
    const { guard, evaluator } = guardWith(false);
    expect(guard.canActivate(contextFor(() => {}, {}))).toBe(true);
    expect(evaluator.isEnabled).not.toHaveBeenCalled();
  });

  it('evaluates for the caller the auth guard resolved', () => {
    const { guard, evaluator } = guardWith(true);
    const request = {
      user: { id: 'u1', email: 'ada@acme.com', role: 'user' },
      session: { activeOrganizationId: 'org-1' },
    };

    expect(guard.canActivate(contextFor(gated, request))).toBe(true);
    expect(evaluator.isEnabled).toHaveBeenCalledWith(
      'api_token_creation',
      expect.objectContaining({ userId: 'u1', organizationId: 'org-1', email: 'ada@acme.com' }),
    );
  });

  it('refuses with the catalog code, not a bare 403', () => {
    const { guard } = guardWith(false);
    expect(() => guard.canActivate(contextFor(gated, {}))).toThrow(
      expect.objectContaining({ code: FeatureFlagErrors.FEATURE_DISABLED.code }),
    );
  });
});
