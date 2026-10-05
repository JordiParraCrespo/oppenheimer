import { SetMetadata } from '@nestjs/common';

export const USES_BETTER_AUTH_SESSION_KEY = 'uses_better_auth_session';

/**
 * Marks a controller (or handler) that calls `auth.api.*` with the incoming
 * headers, so it needs the caller as a Better Auth session. For a scoped
 * credential `ApiAuthGuard` then mints (or reuses) a delegated session and
 * presents it as the bearer; other routes skip that Redis round trip.
 *
 * A new façade over `auth.api.*` must carry this, or it answers a scoped
 * credential as if nobody were signed in; `delegated-session-coverage.spec.ts`
 * fails when one does not.
 *
 * @example
 * ```ts
 * @UsesBetterAuthSession()
 * @Controller('organizations')
 * export class OrganizationsController {}
 * ```
 */
export const UsesBetterAuthSession = () => SetMetadata(USES_BETTER_AUTH_SESSION_KEY, true);
