import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialScopePort } from '../../auth/application/credential-scope.port';
import { CREDENTIAL_SCOPE } from '../../auth/auth.di-tokens';
import { isHostCredential, type ScopedRequest } from '../../auth/domain/scope-context.types';
import { HOST_PRINCIPAL, type HostPrincipalRequest } from '../decorators/current-host.decorator';
import { HostErrors } from '../domain/hosts.errors';

/**
 * Admits a request only when its credential is a host's own boot assertion, and
 * leaves the named host where `@CurrentHost()` can read it.
 *
 * No person is behind such a request (no session, roles or scopes), so its routes
 * carry `@NoPolicy` and this guard is their whole authorization. Everyone else is
 * refused, a valid API token included: a route for a machine to call about itself is
 * not one a person's credential should reach.
 *
 * Resolution goes through the shared port, memoized per request, and that matters:
 * verifying an assertion burns its `jti`, so a second verification would refuse the
 * token as a replay.
 */
@Injectable()
export class HostPrincipalGuard implements CanActivate {
  constructor(
    @Inject(CREDENTIAL_SCOPE)
    private readonly credentials: CredentialScopePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest & HostPrincipalRequest>();

    // An unrecognisable bearer throws from the resolver with the same opaque
    // answer it gives everywhere else; a session or a token resolves to
    // something that is simply not a host.
    const credential = await this.credentials.resolve(request);

    if (!isHostCredential(credential)) {
      // Returning `false` would hand back Nest's own codeless 403; the catalog
      // error is what the runner reads a `detail` out of.
      throw new AppError(HostErrors.ASSERTION_REJECTED, {
        detail: 'This endpoint is reachable only by a host presenting its own boot assertion.',
      });
    }

    request[HOST_PRINCIPAL] = { hostId: credential.hostId };
    return true;
  }
}
