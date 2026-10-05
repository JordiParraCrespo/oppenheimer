import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@oppenheimer/backend-core';
import { isOrganizationAllowed, missingScopes, type Scope } from '@oppenheimer/shared';
import type { CredentialScopePort } from '../application/credential-scope.port';
import type { RequestTenantPort } from '../application/request-tenant.port';
import { CREDENTIAL_SCOPE, REQUEST_TENANT } from '../auth.di-tokens';
import { ALLOW_ANY_SCOPE_KEY, REQUIRE_SCOPES_KEY } from '../decorators/require-scopes.decorator';
import { AuthErrors } from '../domain/auth.errors';
import type { ScopeContext, ScopedRequest } from '../domain/scope-context.types';

/**
 * Enforces what a scoped credential may reach. Registered globally, so it
 * applies to every route whether or not the route asked for it.
 *
 * Browser sessions pass straight through; the user's roles govern them via
 * `PoliciesGuard`. An API token or OAuth access token needs:
 *
 * 1. `@RequireScopes` on the route (or `@AllowAnyScope()`); a route that
 *    declares nothing is closed to tokens;
 * 2. every declared scope on the credential;
 * 3. the route's organization within the credential's restriction.
 *
 * `PoliciesGuard` still checks the owner's live roles, so the effective
 * permission is the intersection.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CREDENTIAL_SCOPE)
    private readonly credentials: CredentialScopePort,
    @Inject(REQUEST_TENANT)
    private readonly tenants: RequestTenantPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const scopeContext = await this.credentials.resolve(request);
    if (!scopeContext) return true;

    const allowAnyScope = this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowAnyScope) this.assertScopes(context, scopeContext);
    this.assertOrganization(context, request, scopeContext);

    return true;
  }

  private assertScopes(context: ExecutionContext, scopeContext: ScopeContext): void {
    const required = this.reflector.getAllAndOverride<Scope[]>(REQUIRE_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      throw new AppError(AuthErrors.ENDPOINT_NOT_TOKEN_ACCESSIBLE);
    }

    const missing = missingScopes(scopeContext.scopes, required);
    if (missing.length > 0) {
      // Which scopes are missing varies per request, so it belongs in the
      // problem's `detail` (and as an extension a client can act on), never in
      // the catalog message that titles the problem type.
      throw new AppError(AuthErrors.INSUFFICIENT_SCOPE, {
        detail: `This credential is missing: ${missing.join(', ')}`,
        extensions: { missingScopes: missing },
      });
    }
  }

  /**
   * The request's tenant — stamped here, through the one writer, because this
   * guard runs before `ApiAuthGuard` — must be within the credential's
   * organizations.
   */
  private assertOrganization(
    context: ExecutionContext,
    request: ScopedRequest,
    scopeContext: ScopeContext,
  ): void {
    if (!scopeContext.resourceScope.organizationIds) return;

    const { organizationId } = this.tenants.stamp(context, request, scopeContext);
    if (!isOrganizationAllowed(scopeContext.resourceScope, organizationId)) {
      throw new AppError(AuthErrors.ORGANIZATION_OUT_OF_SCOPE);
    }
  }
}
