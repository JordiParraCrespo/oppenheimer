import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialScopePort } from '../../auth/application/credential-scope.port';
import { CREDENTIAL_SCOPE } from '../../auth/auth.di-tokens';
import type { ScopedRequest } from '../../auth/domain/scope-context.types';
import { HostErrors } from '../domain/hosts.errors';

/**
 * Admits a request only when the credential on it is a host's own boot
 * assertion.
 *
 * There is no person behind such a request — no session, no roles, no scopes —
 * so the routes it guards carry `@NoPolicy` and this guard is the whole of their
 * authorization. Everyone else is refused here, including a perfectly valid API
 * token: a route that exists for a machine to call about itself is not a route a
 * person's credential should reach.
 *
 * It resolves the credential itself rather than reading what another guard left
 * behind. Resolution is memoized on the request, so asking costs nothing — and
 * a guard whose correctness depended on the order guards happen to run in would
 * be a guard that silently stops working when that order changes.
 */
@Injectable()
export class HostPrincipalGuard implements CanActivate {
  constructor(
    @Inject(CREDENTIAL_SCOPE)
    private readonly credentials: CredentialScopePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest>();

    // Classifying the credential is what puts the host principal on the request
    // (see `CredentialScopeResolver`); an unrecognisable bearer throws from
    // there with the same opaque answer it gives everywhere else.
    await this.credentials.resolve(request);

    if (!request.hostPrincipal) {
      // Returning `false` would hand back Nest's own codeless 403; the catalog
      // error is what the runner reads a `detail` out of.
      throw new AppError(HostErrors.ASSERTION_REJECTED, {
        detail: 'This endpoint is reachable only by a host presenting its own boot assertion.',
      });
    }

    return true;
  }
}
