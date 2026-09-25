import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NO_POLICY_KEY } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { defineAbilitiesFromPermissions } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AbilityPort } from '../../application/ability.port';
import { CHECK_POLICIES_KEY } from '../../decorators/check-policies.decorator';
import { AuthErrors } from '../../domain/auth.errors';
import { PoliciesGuard } from '../policies.guard';

/** Metadata the route under test declares, keyed the way the reflector reads it. */
type Metadata = Record<string, unknown>;

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function reflectorFor(metadata: Metadata): Reflector {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (key: unknown) => metadata[key as string],
    // biome-ignore lint/suspicious/noExplicitAny: the reflector's generic signature is not worth reproducing here
  ) as any;
  return reflector;
}

describe('PoliciesGuard', () => {
  let abilities: AbilityPort;

  beforeEach(() => {
    abilities = {
      forRequest: vi
        .fn()
        .mockResolvedValue(
          defineAbilitiesFromPermissions([{ action: 'read', subject: 'Project' }]),
        ),
    };
  });

  it('allows a route whose policy the caller satisfies', async () => {
    const guard = new PoliciesGuard(
      reflectorFor({
        [CHECK_POLICIES_KEY]: [{ action: 'read', subject: 'Project' }],
      }),
      abilities,
    );

    await expect(guard.canActivate(contextWith({ user: { id: 'u1' } }))).resolves.toBe(true);
  });

  it('denies a route whose policy the caller does not satisfy', async () => {
    const guard = new PoliciesGuard(
      reflectorFor({
        [CHECK_POLICIES_KEY]: [{ action: 'delete', subject: 'Project' }],
      }),
      abilities,
    );

    // Returning `false` would hand back Nest's own codeless 403; the guard
    // throws the catalog error so the response carries AUTH_002.
    const error = await guard
      .canActivate(contextWith({ user: { id: 'u1' } }))
      .catch((thrown: AppError) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(AuthErrors.FORBIDDEN.code);
  });

  it('rejects a route that declares no policy at all', async () => {
    // The regression this guard exists to prevent: before, an undeclared route
    // was reachable by any authenticated caller.
    const guard = new PoliciesGuard(reflectorFor({}), abilities);

    await expect(guard.canActivate(contextWith({ user: { id: 'u1' } }))).rejects.toThrow(AppError);
  });

  it('allows a route with an explicit reasoned exemption', async () => {
    const guard = new PoliciesGuard(
      reflectorFor({ [NO_POLICY_KEY]: 'returns the caller’s own profile' }),
      abilities,
    );

    await expect(guard.canActivate(contextWith({ user: { id: 'u1' } }))).resolves.toBe(true);
  });

  it('reports a missing principal as unauthenticated, not forbidden', async () => {
    const guard = new PoliciesGuard(
      reflectorFor({
        [CHECK_POLICIES_KEY]: [{ action: 'read', subject: 'Project' }],
      }),
      abilities,
    );

    // 401 tells the client to re-authenticate; a 403 would have it give up on
    // a request a fresh session would satisfy.
    const error = await guard.canActivate(contextWith({})).catch((thrown: AppError) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(AuthErrors.UNAUTHENTICATED.code);
  });

  it('builds the ability once per request', async () => {
    const guard = new PoliciesGuard(
      reflectorFor({
        [CHECK_POLICIES_KEY]: [{ action: 'read', subject: 'Project' }],
      }),
      abilities,
    );
    const request = { user: { id: 'u1' } };

    await guard.canActivate(contextWith(request));

    expect(abilities.forRequest).toHaveBeenCalledTimes(1);
  });
});
