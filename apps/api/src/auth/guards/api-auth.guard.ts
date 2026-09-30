import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialScopePort } from '../application/credential-scope.port';
import type { RequestTenantPort } from '../application/request-tenant.port';
import { CREDENTIAL_SCOPE, DELEGATED_SESSION, REQUEST_TENANT } from '../auth.di-tokens';
import { USES_BETTER_AUTH_SESSION_KEY } from '../decorators/uses-better-auth-session.decorator';
import { isAccessAllowed } from '../domain/account-access.policy';
import { AuthErrors } from '../domain/auth.errors';
import {
  isHostCredential,
  pinnedOrganizationIdOf,
  type ScopedRequest,
} from '../domain/scope-context.types';
import type { DelegatedSessionPort } from '../infrastructure/delegated-session.port';

/**
 * Authenticates a request by any supported credential, populates
 * `request.user` / `request.session` / `request.scopeContext`, and stamps
 * `request.tenant` (see `REQUEST_TENANT`) before any guard or handler builds
 * an ability. Replaces Better Auth's `AuthGuard`, which only understands
 * session cookies.
 *
 * On a `@UsesBetterAuthSession()` route a scoped credential also gets a
 * delegated Better Auth session, and `Authorization` is rewritten to it. It
 * verifies nothing itself (`CREDENTIAL_SCOPE` resolves each credential once per
 * request) and decides nothing: `PoliciesGuard` applies the owner's roles, the
 * global `ScopesGuard` the credential's scopes.
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiAuthGuard.name);

  constructor(
    @Inject(CREDENTIAL_SCOPE)
    private readonly credentials: CredentialScopePort,
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
    @Inject(REQUEST_TENANT)
    protected readonly tenants: RequestTenantPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    await this.authenticate(context, request);
    this.tenants.stamp(context, request);
    return true;
  }

  private async authenticate(context: ExecutionContext, request: ScopedRequest): Promise<void> {
    const scopeContext = await this.credentials.resolve(request);

    if (!scopeContext) return this.authenticateSession(request);

    // A machine credential acts for nobody: there is no owner to populate
    // `request.user` with and no session to delegate, so every route this guard
    // protects is closed to it. The routes a host may call carry their own guard
    // instead and read the same resolution through `CREDENTIAL_SCOPE`.
    if (isHostCredential(scopeContext)) {
      throw new AppError(AuthErrors.UNAUTHENTICATED, {
        detail: 'This endpoint requires a user credential; a machine credential acts for no user.',
      });
    }

    // A token restricted to exactly one organization acts inside it by
    // default, so organization-scoped routes resolve without an explicit id.
    const pinnedOrganizationId = pinnedOrganizationIdOf(scopeContext);

    if (this.usesBetterAuthSession(context)) {
      const sessionToken = await this.delegatedSessions.resolveSessionToken({
        credentialId: scopeContext.credentialId,
        userId: scopeContext.owner.id,
        label: `oppenheimer-${scopeContext.kind}/${scopeContext.prefix ?? scopeContext.credentialId}`,
        activeOrganizationId: pinnedOrganizationId,
      });

      if (sessionToken) {
        request.headers.authorization = `Bearer ${sessionToken}`;
      }
    }

    request.scopeContext = scopeContext;
    request.user = { ...scopeContext.owner };
    request.session = {
      activeOrganizationId: pinnedOrganizationId,
      activeTeamId: null,
    };
  }

  private usesBetterAuthSession(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(USES_BETTER_AUTH_SESSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  /**
   * Session path: a session cookie, or a session token presented as a bearer.
   * Note that `request.session` is set to the session itself (not Better
   * Auth's `{ session, user }` envelope), which is the shape the
   * `REQUEST_TENANT` port reads `activeOrganizationId` from.
   */
  private async authenticateSession(request: ScopedRequest): Promise<void> {
    const session = await this.credentials.resolveSession(request);

    // A session outlives the account's standing: a deactivation deletes no
    // session rows, and a ban expires on its own clock. So the rule the
    // credential owner lookup applies is asked here too, on every request.
    const refused = session !== null && !isAccessAllowed(session.user, new Date());
    if (refused) {
      this.logger.log({ message: 'session refused: account may not act', userId: session.user.id });
    }

    request.session = session && !refused ? session.session : null;
    request.user = session && !refused ? session.user : null;
    request.scopeContext = null;

    if (!session || refused) {
      // The token paths report TOKEN_003 from `CredentialScopeResolver`; the
      // cookie path gets its own code rather than Nest's codeless 401, so every
      // authentication failure is something a client can branch on. A refused
      // account gets the same detail as no session at all, so the response
      // does not say the account is banned.
      throw new AppError(AuthErrors.UNAUTHENTICATED, {
        detail: 'No valid session cookie or bearer credential was presented.',
      });
    }
  }
}
