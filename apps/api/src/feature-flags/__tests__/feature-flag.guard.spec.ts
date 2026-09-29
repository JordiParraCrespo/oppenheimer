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

/** An evaluator that turns the flag on for one organization only. */
function guardFor(organizationId: string) {
  const evaluator: Pick<FlagEvaluatorPort, 'isEnabled'> = {
    isEnabled: vi.fn((_key, context) => context.organizationId === organizationId),
  };
  return {
    guard: new FeatureFlagGuard(new Reflector(), evaluator as FlagEvaluatorPort),
    evaluator,
  };
}

describe('FeatureFlagGuard', () => {
  const gated = () => {};
  Reflect.defineMetadata(REQUIRE_FLAG_KEY, 'api_token_creation', gated);

  it('lets an ungated route through without evaluating anything', () => {
    const { guard, evaluator } = guardFor('org-1');
    expect(guard.canActivate(contextFor(() => {}, {}))).toBe(true);
    expect(evaluator.isEnabled).not.toHaveBeenCalled();
  });

  it('serves a gated route to a caller the flag is on for', () => {
    const { guard } = guardFor('org-1');
    const request = {
      user: { id: 'u1', email: 'ada@acme.com', role: 'user' },
      tenant: { organizationId: 'org-1' },
    };

    expect(guard.canActivate(contextFor(gated, request))).toBe(true);
  });

  it.each([
    ['another organization', { user: { id: 'u2' }, tenant: { organizationId: 'org-2' } }],
    ['an anonymous caller', {}],
  ])('refuses %s with the catalog code, not a bare 403', (_who, request) => {
    const { guard } = guardFor('org-1');
    expect(() => guard.canActivate(contextFor(gated, request))).toThrow(
      expect.objectContaining({ code: FeatureFlagErrors.FEATURE_DISABLED.code }),
    );
  });
});
