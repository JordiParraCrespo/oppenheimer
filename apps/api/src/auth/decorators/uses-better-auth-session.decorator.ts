import { SetMetadata } from '@nestjs/common';

export const USES_BETTER_AUTH_SESSION_KEY = 'uses_better_auth_session';

/**
 * Marks a controller (or one handler) that calls Better Auth's server API
 * (`auth.api.*`) with the incoming headers, so it needs the caller as a Better
 * Auth session.
 *
 * A browser session already is one. A scoped credential — an API token, an
 * OAuth grant — is not, so for these routes `ApiAuthGuard` mints (or reuses) a
 * short-lived delegated session for the credential's owner and presents it as
 * the request's bearer. Every other route skips that: most of the API never
 * calls Better Auth, and resolving a delegated session there was a Redis round
 * trip for nothing.
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
