import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@oppenheimer/backend-core';
import { isOrganizationAllowed, missingScopes, type Scope } from '@oppenheimer/shared';
import { ApiTokenErrors } from '../../api-tokens/domain/api-token.errors';
import type { CredentialScopePort } from '../application/credential-scope.port';
import { CREDENTIAL_SCOPE } from '../auth.di-tokens';
import { ORGANIZATION_PARAM_KEY } from '../decorators/organization-scoped.decorator';
import { ALLOW_ANY_SCOPE_KEY, REQUIRE_SCOPES_KEY } from '../decorators/require-scopes.decorator';
import type { ScopeContext, ScopedRequest } from '../domain/scope-context.types';

/**
 * Enforces what a scoped credential may reach. Registered globally, so it
 * applies to every route whether or not the route remembered to ask for it.
 *
 * Requests authenticated by a browser session pass straight through — they are
 * governed by the user's roles via `PoliciesGuard`. Requests carrying an API
 * token or OAuth access token must satisfy three things:
 *
 * 1. the route declares `@RequireScopes` (a route that declares nothing is
 *    closed to tokens — new endpoints are not silently reachable);
 * 2. the credential carries every declared scope;
 * 3. the organization the route acts on is within the credential's restriction.
 *
 * This is only half of the check. The credential's owner still has to be
 * allowed to perform the operation at all, which `PoliciesGuard` evaluates
 * against their live roles — so the effective permission is the intersection.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CREDENTIAL_SCOPE)
    private readonly credentials: CredentialScopePort,
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
      throw new AppError(ApiTokenErrors.ENDPOINT_NOT_TOKEN_ACCESSIBLE);
    }

    const missing = missingScopes(scopeContext.scopes, required);
    if (missing.length > 0) {
      // Which scopes are missing varies per request, so it belongs in the
      // problem's `detail` (and as an extension a client can act on), never in
      // the catalog message that titles the problem type.
      throw new AppError(ApiTokenErrors.INSUFFICIENT_SCOPE, {
        detail: `This credential is missing: ${missing.join(', ')}`,
        extensions: { missingScopes: missing },
      });
    }
  }

  private assertOrganization(
    context: ExecutionContext,
    request: ScopedRequest,
    scopeContext: ScopeContext,
  ): void {
    if (!scopeContext.resourceScope.organizationIds) return;

    const organizationId = this.organizationIdFor(context, request);
    if (!isOrganizationAllowed(scopeContext.resourceScope, organizationId)) {
      throw new AppError(ApiTokenErrors.ORGANIZATION_OUT_OF_SCOPE);
    }
  }

  /**
   * The organization this request acts on: the parameter the route declared
   * via `@OrganizationScoped`, falling back to an explicit `organizationId` in
   * the body or query string.
   */
  private organizationIdFor(context: ExecutionContext, request: ScopedRequest): string | null {
    const param = this.reflector.getAllAndOverride<string>(ORGANIZATION_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const params = request.params as Record<string, unknown> | undefined;
    const candidate = param ? params?.[param] : undefined;
    const fromParam = typeof candidate === 'string' ? candidate : undefined;
    const body = request.body as Record<string, unknown> | undefined;
    const fromBody = typeof body?.organizationId === 'string' ? body.organizationId : undefined;
    const query = request.query as Record<string, unknown> | undefined;
    const fromQuery = typeof query?.organizationId === 'string' ? query.organizationId : undefined;

    return fromParam ?? fromBody ?? fromQuery ?? null;
  }
}
