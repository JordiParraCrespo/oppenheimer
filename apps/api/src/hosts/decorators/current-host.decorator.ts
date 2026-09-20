import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { HostErrors } from '../domain/hosts.errors';

/**
 * Where `HostPrincipalGuard` leaves the host it admitted.
 *
 * A symbol, and a module-local one: the credential that names a machine is this
 * module's business, and nothing outside the two routes that accept one should
 * be able to find it — least of all by growing another optional field on the
 * request type every controller in the API names.
 */
export const HOST_PRINCIPAL = Symbol('oppenheimer.hostPrincipal');

/** A request the guard has admitted, carrying the host that signed it. */
export interface HostPrincipalRequest {
  [HOST_PRINCIPAL]?: { hostId: string };
}

/**
 * The host a request was admitted as, or a refusal.
 *
 * Separate from the decorator so it can be tested as the function it is, and so
 * a gateway that does not go through Nest's HTTP pipeline can ask the same
 * question when the relay arrives.
 */
export function hostPrincipalOf(request: HostPrincipalRequest): string {
  const principal = request[HOST_PRINCIPAL];
  // Unreachable through the guard; a programming error if a route ever uses
  // `@CurrentHost()` without it, and a 401 is the safe way for that to surface.
  if (!principal) {
    throw new AppError(HostErrors.ASSERTION_REJECTED, {
      detail: 'This route read a host principal without admitting one.',
    });
  }
  return principal.hostId;
}

/**
 * The id of the host calling, as `HostPrincipalGuard` verified it.
 *
 * Typed as a plain `string` because the guard runs first and refuses anything it
 * could not name — the alternative is a cast at the call site, which is the
 * handler asserting what the guard already proved.
 */
export const CurrentHost = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  hostPrincipalOf(context.switchToHttp().getRequest<HostPrincipalRequest>()),
);
