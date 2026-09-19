import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialScopePort } from '../../auth/application/credential-scope.port';
import { CREDENTIAL_SCOPE } from '../../auth/auth.di-tokens';
import type { ScopedRequest } from '../../auth/domain/scope-context.types';
import { HOST_PRINCIPAL, type HostPrincipalRequest } from '../decorators/current-host.decorator';
import { HostErrors } from '../domain/hosts.errors';

/**
 * Admits a request only when the credential on it is a host's own boot
 * assertion, and leaves the host it named where `@CurrentHost()` can read it.
 *
 * There is no person behind such a request — no session, no roles, no scopes —
 * so the routes it guards carry `@NoPolicy` and this guard is the whole of their
 * authorization. Everyone else is refused here, including a perfectly valid API
 * token: a route that exists for a machine to call about itself is not a route a
 * person's credential should reach.
 *
 * The credential is resolved through the same port every other guard uses, and
 * the resolution is memoized per request — which matters more than it looks:
 * verifying an assertion burns its `jti`, so a second verification of the same
 * token would refuse itself as a replay.
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

    if (credential?.kind !== 'host') {
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
