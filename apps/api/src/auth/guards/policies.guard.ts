import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NO_POLICY_KEY } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { AuthzErrors } from '../../authz/domain/authz.errors';
import { AbilityFactory } from '../../roles/application/ability.factory';
import { CHECK_POLICIES_KEY, type PolicyRule } from '../decorators/check-policies.decorator';
import { AuthErrors } from '../domain/auth.errors';

/**
 * Authorization guard. Resolves the caller's effective CASL ability from their
 * database-backed roles and checks it against the `@CheckPolicies` rules on the
 * route. The ability is attached to `request.ability` so handlers can perform
 * instance-level checks.
 *
 * **Fails closed.** A route that declares neither `@CheckPolicies` nor an
 * explicit `@NoPolicy('reason')` is rejected. The previous behaviour — allow
 * any authenticated caller — meant a forgotten decorator silently opened an
 * endpoint, which is the opposite of how `ScopesGuard` treats the same
 * omission. `route-policy-coverage.spec.ts` turns that rejection into a build
 * failure so it is caught when the route is written.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<PolicyRule[]>(CHECK_POLICIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const exemption = this.reflector.getAllAndOverride<string>(NO_POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rules || rules.length === 0) {
      if (exemption) return true;
      // A programming error, not a client one: the route reached production
      // without saying what it requires.
      throw new AppError(AuthzErrors.ROUTE_HAS_NO_POLICY);
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No principal at all is an *authentication* failure, not a permission
    // one — 401 tells a client to re-authenticate, where a 403 would have it
    // give up on a request that a fresh session would satisfy.
    if (!user) {
      throw new AppError(AuthErrors.UNAUTHENTICATED, {
        detail: 'This endpoint requires an authenticated caller.',
      });
    }

    // Memoized on the request: four call sites resolve the ability during a
    // single request, and `forRequest` also attaches it to `request.ability`.
    const ability = await this.abilityFactory.forRequest(request);

    // Returning `false` would hand back Nest's own codeless 403; throw the
    // catalog error instead so the response carries `AUTH_002` like every other
    // failure. The rule that failed is deliberately not named — see the catalog.
    if (!rules.every((rule) => ability.can(rule.action, rule.subject))) {
      throw new AppError(AuthErrors.FORBIDDEN);
    }

    return true;
  }
}
