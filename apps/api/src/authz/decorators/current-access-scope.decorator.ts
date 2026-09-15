import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';

/** Where `AccessScopeInterceptor` leaves the resolved scope. */
export const ACCESS_SCOPE_KEY = 'accessScope';

/**
 * Injects the caller's resolved {@link AccessScope}.
 *
 * Only populated on routes whose controller applies `AccessScopeInterceptor`;
 * resolving it for every request would spend two queries on routes that never
 * touch a scoped resource.
 */
export const CurrentAccessScope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessScope => {
    const request = context.switchToHttp().getRequest();
    const scope = request[ACCESS_SCOPE_KEY];
    if (!scope) {
      throw new Error(
        'No AccessScope on the request. Add @UseInterceptors(AccessScopeInterceptor) to the controller.',
      );
    }
    return scope;
  },
);
