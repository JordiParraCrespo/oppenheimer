import { SetMetadata } from '@nestjs/common';
import type { Scope } from '@oppenheimer/shared';

export const REQUIRE_SCOPES_KEY = 'require_scopes';

/**
 * Declares the scopes a *scoped credential* (API token or OAuth access token)
 * must carry to call this route. Browser sessions ignore it — they are governed
 * by `@CheckPolicies` and the user's roles.
 *
 * Declaring this is what makes a route reachable by a token at all: the global
 * `ScopesGuard` refuses scoped credentials on routes that declare nothing, so
 * new endpoints are closed to tokens until someone decides what they cost.
 *
 * @example
 * ```ts
 * @Get()
 * @CheckPolicies({ action: 'read', subject: 'User' })
 * @RequireScopes('users:read')
 * findAll() {}
 * ```
 */
export const RequireScopes = (...scopes: Scope[]) => SetMetadata(REQUIRE_SCOPES_KEY, scopes);

export const ALLOW_ANY_SCOPE_KEY = 'allow_any_scope';

/**
 * Marks a route as reachable by any authenticated credential, scoped or not,
 * without requiring a specific permission. Reserved for routes that only ever
 * expose the caller's own identity.
 */
export const AllowAnyScope = () => SetMetadata(ALLOW_ANY_SCOPE_KEY, true);
