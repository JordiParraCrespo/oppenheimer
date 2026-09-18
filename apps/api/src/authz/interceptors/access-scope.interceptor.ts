import type { NestInterceptor } from '@nestjs/common';
import { type CallHandler, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { SCOPE_RESOLVER, type ScopeResolverPort } from '@oppenheimer/backend-authz';
import { ROLES } from '@oppenheimer/shared';
import type { Observable } from 'rxjs';
import { AbilityFactory } from '../../roles/application/ability.factory';
import {
  ACTIVE_ORGANIZATION_HEADER,
  ActiveOrganizationResolver,
} from '../application/active-organization.resolver';
import { ACCESS_SCOPE_KEY } from '../decorators/current-access-scope.decorator';

/** Instance-level roles that short-circuit scoping (Q0). */
const PLATFORM_ROLES: readonly string[] = [ROLES.SUPERADMIN, ROLES.ADMIN];

/**
 * Resolves the caller's {@link AccessScope} and attaches it to the request.
 *
 * Applied per controller rather than globally: resolving membership costs two
 * queries, and only routes touching a scoped resource need it.
 *
 * Order matters — this runs after the auth guards have populated
 * `request.user`, and the scope it produces is what both the CASL conditions
 * and the SQL predicate are built from, so the two always agree.
 */
@Injectable()
export class AccessScopeInterceptor implements NestInterceptor {
  constructor(
    @Inject(SCOPE_RESOLVER)
    private readonly scopeResolver: ScopeResolverPort,
    private readonly abilityFactory: AbilityFactory,
    private readonly activeOrganization: ActiveOrganizationResolver,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string; role?: string } | undefined;

    if (user?.id) {
      const organizationId = await this.activeOrganization.resolve({
        userId: user.id,
        sessionOrganizationId: request.session?.activeOrganizationId ?? null,
        header: request.headers?.[ACTIVE_ORGANIZATION_HEADER],
      });

      // The ability is memoized on the request, so asking it whether the caller
      // holds `manage all` costs nothing the guard was not already paying.
      const ability = await this.abilityFactory.forRequest(request);

      request[ACCESS_SCOPE_KEY] = await this.scopeResolver.resolve({
        userId: user.id,
        organizationId,
        isPlatformAdmin: PLATFORM_ROLES.includes(user.role ?? ''),
        hasFullAccess: ability.can('manage', 'all'),
      });
      request.activeOrganizationId = organizationId;
    }

    return next.handle();
  }
}
