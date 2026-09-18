import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialScopePort } from '../application/credential-scope.port';
import { CREDENTIAL_SCOPE, DELEGATED_SESSION } from '../auth.di-tokens';
import { AuthErrors } from '../domain/auth.errors';
import type { ScopedRequest } from '../domain/scope-context.types';
import { auth } from '../infrastructure/better-auth.config';
import { betterAuthHeaders } from '../infrastructure/better-auth.util';
import type { DelegatedSessionPort } from '../infrastructure/delegated-session.port';

/**
 * Authenticates a request by any of the three supported credentials and
 * populates `request.user` / `request.session` / `request.scopeContext`.
 *
 * Replaces Better Auth's own `AuthGuard`, which only understands session
 * cookies. For a scoped credential this guard additionally mints a short-lived
 * delegated Better Auth session and rewrites the `Authorization` header to it,
 * so the façade modules that call `auth.api.*` with the incoming headers keep
 * working unchanged.
 *
 * It does **not** decide what the credential may do: `PoliciesGuard` applies
 * the owner's roles and the global `ScopesGuard` applies the credential's
 * scopes.
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    @Inject(CREDENTIAL_SCOPE)
    private readonly credentials: CredentialScopePort,
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const scopeContext = await this.credentials.resolve(request);

    if (!scopeContext) return this.authenticateSession(request);

    // A token restricted to exactly one organization acts inside it by
    // default, so organization-scoped routes resolve without an explicit id.
    const pinnedOrganizationId =
      scopeContext.resourceScope.organizationIds?.length === 1
        ? scopeContext.resourceScope.organizationIds[0]
        : null;

    const sessionToken = await this.delegatedSessions.resolveSessionToken({
      credentialId: scopeContext.credentialId,
      userId: scopeContext.owner.id,
      label: `oppenheimer-${scopeContext.kind}/${scopeContext.prefix ?? scopeContext.credentialId}`,
      activeOrganizationId: pinnedOrganizationId,
    });

    if (sessionToken) {
      // Present the delegated session to anything downstream that resolves the
      // caller through Better Auth (the organization/admin façades).
      request.headers.authorization = `Bearer ${sessionToken}`;
    }

    request.scopeContext = scopeContext;
    request.user = { ...scopeContext.owner };
    request.session = {
      activeOrganizationId: pinnedOrganizationId,
      activeTeamId: null,
    };

    return true;
  }

  /**
   * Cookie-session path. Note that `request.session` is set to the session
   * itself (not Better Auth's `{ session, user }` envelope), which is the shape
   * `PoliciesGuard` reads `activeOrganizationId` from.
   */
  private async authenticateSession(request: ScopedRequest): Promise<boolean> {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(request.headers),
    });

    request.session = session?.session ?? null;
    request.user = session?.user ?? null;
    request.scopeContext = null;

    if (!session) {
      // The token paths report TOKEN_003 from `CredentialScopeResolver`; the
      // cookie path gets its own code rather than Nest's codeless 401, so every
      // authentication failure is something a client can branch on.
      throw new AppError(AuthErrors.UNAUTHENTICATED, {
        detail: 'No valid session cookie or bearer credential was presented.',
      });
    }
    return true;
  }
}
