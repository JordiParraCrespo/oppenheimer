import type { NestInterceptor } from '@nestjs/common';
import { type CallHandler, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { SCOPE_RESOLVER, type ScopeResolverPort } from '@oppenheimer/backend-authz';
import { ROLES } from '@oppenheimer/shared';
import type { Observable } from 'rxjs';
import { tenantOrganizationIdOf } from '../../auth/domain/request-tenant.types';
import { AbilityFactory } from '../../roles/application/ability.factory';
import { ACCESS_SCOPE_KEY } from '../decorators/current-access-scope.decorator';

/** Instance-level roles that short-circuit scoping (Q0). */
const PLATFORM_ROLES: readonly string[] = [ROLES.SUPERADMIN, ROLES.ADMIN];

/**
 * Resolves the caller's {@link AccessScope} and attaches it to the request.
 *
 * Applied per controller rather than globally: resolving membership costs two
 * queries (team membership, then grants), and only routes touching a scoped
 * resource need it.
 *
 * Order matters — this runs after the auth guards have populated
 * `request.user` and stamped `request.tenant`. The scope is resolved in that
 * tenant, the same organization the ability was built in, so the CASL
 * conditions and the SQL predicate always name one organization.
 */
@Injectable()
export class AccessScopeInterceptor implements NestInterceptor {
  constructor(
    @Inject(SCOPE_RESOLVER)
    private readonly scopeResolver: ScopeResolverPort,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string; role?: string } | undefined;

    if (user?.id) {
      const organizationId = tenantOrganizationIdOf(request);

      // The ability and the role ids it was built from are memoized per
      // request, so asking whether the caller holds `manage all`, and which
      // roles grants may address, costs nothing the guard was not already
      // paying — `user_role` is not read a second time.
      const [ability, roleIds] = await Promise.all([
        this.abilityFactory.forRequest(request),
        this.abilityFactory.roleIdsForRequest(request),
      ]);

      request[ACCESS_SCOPE_KEY] = await this.scopeResolver.resolve({
        userId: user.id,
        organizationId,
        isPlatformAdmin: PLATFORM_ROLES.includes(user.role ?? ''),
        hasFullAccess: ability.can('manage', 'all'),
        roleIds,
      });
    }

    return next.handle();
  }
}
