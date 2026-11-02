import type { BetterAuthOptions } from 'better-auth';

/** The two variables the decision reads, passed in by name so the environment check sees the reads. */
export interface AuthRateLimitEnv {
  AUTH_RATE_LIMIT_ENABLED?: string;
  NODE_ENV?: string;
}

/**
 * Better Auth's limiter, the only one in front of `/api/auth/*`: that handler is
 * mounted on the HTTP adapter before Nest binds anything, so the Nest throttler
 * never sees these routes. `storage: 'database'` keeps the counters in Postgres
 * so a limit holds across API replicas and restarts.
 *
 * On everywhere, development included, because a deployment that is not
 * `production` is not therefore private. The exceptions are a process under
 * `NODE_ENV=test` and an explicit `AUTH_RATE_LIMIT_ENABLED=false`, which is how
 * the e2e stack (`e2e/support/stub-env.ts`) keeps a suite that signs in
 * hundreds of times from one address from throttling itself.
 *
 * Each custom rule replaces Better Auth's default for its path; the ones it
 * would apply anyway are written out so the numbers are read here, not in a
 * dependency.
 */
export function authRateLimit(env: AuthRateLimitEnv): NonNullable<BetterAuthOptions['rateLimit']> {
  return {
    enabled: authRateLimitEnabled(env),
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
      '/forget-password': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
      '/reset-password': { window: 60, max: 5 },
      // Sends an email to whichever address the body names.
      '/send-verification-email': { window: 60, max: 3 },
      // MCP dynamic client registration: anyone may call it, and each call
      // writes an `oauthApplication` row. The registration endpoint's number,
      // as `POST /hosts/register` has it.
      '/mcp/register': { window: 60, max: 5 },
      // A code exchange once per sign-in and a refresh an hour per client, so
      // twenty a minute is a room of clients behind one address, not a guess at
      // a client secret or a refresh token.
      '/mcp/token': { window: 60, max: 20 },
    },
  };
}

/** Off only under `NODE_ENV=test` or when `AUTH_RATE_LIMIT_ENABLED` says `false`; set to anything else, it is on. */
export function authRateLimitEnabled(env: AuthRateLimitEnv): boolean {
  const flag = env.AUTH_RATE_LIMIT_ENABLED?.trim().toLowerCase();
  if (flag) return flag !== 'false';
  return env.NODE_ENV !== 'test';
}
