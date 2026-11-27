import { APIError, getSessionFromCtx } from 'better-auth/api';
import type { Pool } from 'pg';
import { CREDENTIAL_CUTOFF_SQL } from '../database/credential-cutoff.repository';
import { AuthErrors } from '../domain/auth.errors';
import { predatesCutoff } from '../domain/credential-cutoff.policy';
import { mayIssueCredential } from '../domain/credential-issuance.policy';

/**
 * The step of the OAuth (MCP) flow that issues or approves a grant, and what
 * names the account it is for. Each is a door `mayIssueCredential` has to hold:
 *
 * - `POST /oauth2/consent` with `accept: true`: the person on the consent
 *   screen approves a client, so the signed-in session is the account.
 * - `POST /mcp/token` with an authorization code: every code reaches a token
 *   here, including the ones `/mcp/authorize` hands out without a consent
 *   screen and the one the plugin issues on its own after a sign-in, so the
 *   code's owner is the account.
 * - `POST /mcp/token` with a refresh token: a grant made before this rule
 *   existed is not renewed for an account that still has not proven its
 *   address.
 */
export type GrantStep =
  | { by: 'session' }
  | { by: 'authorization-code'; code: string }
  | { by: 'refresh-token'; refreshToken: string };

/**
 * Which grant step this Better Auth request is, if any.
 *
 * The token endpoint reads its body as `z.record(z.any(), z.any())` and calls
 * `toString()` on what it finds, so `"code": ["…"]` or `"code": 123` would
 * still redeem a code that a string check let past the gate. It also treats
 * every `grant_type` but `refresh_token` as a code exchange. So the gate takes
 * the same branches and fails closed: a code or refresh token that is not a
 * non-empty string is refused here (`invalid_request`), never handed on to be
 * stringified.
 */
export function grantStepOf(path: string | undefined, body: unknown): GrantStep | null {
  const fields = formFields(body);
  if (path === '/oauth2/consent') return fields.accept === true ? { by: 'session' } : null;
  if (path !== '/mcp/token') return null;

  if (fields.grant_type === 'refresh_token') {
    return {
      by: 'refresh-token',
      refreshToken: requireString(fields.refresh_token, 'refresh_token'),
    };
  }
  return { by: 'authorization-code', code: requireString(fields.code, 'code') };
}

/** The account a code or refresh token was issued to, and when that was authorized. */
export interface GrantOwner {
  userId: string;
  /**
   * When the sign-in behind the grant happened: a code's `authTime` (the
   * session that authorized it), a refresh token's row. `null` when unknown,
   * which a password reset since then refuses.
   */
  authorizedAt: Date | null;
}

/** What the gate reads; each answers `null` when it finds nothing. */
export interface GrantOwnerLookups {
  sessionUserId(): Promise<string | null>;
  codeOwner(code: string): Promise<GrantOwner | null>;
  refreshTokenOwner(refreshToken: string): Promise<GrantOwner | null>;
  emailVerified(userId: string): Promise<boolean | null>;
  /** The account's credential cutoff (`credential_cutoff`), if a reset set one. */
  credentialCutoff(userId: string): Promise<Date | null>;
}

/** The Better Auth request a `before` hook is handed. */
type AuthHookContext = Parameters<typeof getSessionFromCtx>[0];

/**
 * What the gate reads, for the Better Auth request `ctx`: the session and the
 * code through Better Auth, the refresh token's row, the user's
 * `emailVerified` and the cutoff straight from Better Auth's pool. Fresh every
 * time, never from the session cache: the gate decides on what the database
 * holds now. Reads only (`apps/api/AGENTS.md`, "A Better Auth hook may read").
 */
export function grantOwnerLookups(
  ctx: AuthHookContext,
  pool: Pick<Pool, 'query'>,
): GrantOwnerLookups {
  return {
    sessionUserId: async () => (await getSessionFromCtx(ctx))?.user.id ?? null,
    codeOwner: async (code) => {
      const found = await ctx.context.internalAdapter.findVerificationValue(code);
      return found ? codeOwnerOfVerification(found) : null;
    },
    refreshTokenOwner: async (refreshToken) => {
      const row = (
        await pool.query<{ userId: string | null; createdAt: Date }>(
          `SELECT "userId", "createdAt" FROM "oauthAccessToken" WHERE "refreshToken" = $1`,
          [refreshToken],
        )
      ).rows[0];
      return row?.userId ? { userId: row.userId, authorizedAt: row.createdAt } : null;
    },
    credentialCutoff: async (userId) =>
      (await pool.query<{ issuedBefore: Date }>(CREDENTIAL_CUTOFF_SQL, [userId])).rows[0]
        ?.issuedBefore ?? null,
    emailVerified: async (userId) =>
      (
        await pool.query<{ emailVerified: boolean }>(
          `SELECT "emailVerified" FROM "user" WHERE "id" = $1`,
          [userId],
        )
      ).rows[0]?.emailVerified ?? null,
  };
}

/**
 * Refuse the step when its account has not verified its email (on a
 * deployment that delivers email: `mayIssueCredential`), with the
 * `TOKEN_010` the console's consent screen translates and the OAuth
 * `access_denied` a client reads; and refuse a code or refresh token whose
 * sign-in predates the account's last password reset, with `invalid_grant`.
 * The reset deletes those in its own transaction; this holds for one issued
 * by a request that raced it. A step whose account cannot be found is left to
 * Better Auth, which refuses an unknown code or token on its own terms.
 */
export async function refuseUngrantable(
  step: GrantStep,
  lookups: GrantOwnerLookups,
  deployment: { emailDelivery: boolean },
): Promise<void> {
  const owner =
    step.by === 'session'
      ? await sessionOwner(lookups)
      : step.by === 'authorization-code'
        ? await lookups.codeOwner(step.code)
        : await lookups.refreshTokenOwner(step.refreshToken);
  if (!owner) return;

  const emailVerified = deployment.emailDelivery ? await lookups.emailVerified(owner.userId) : null;
  if (!mayIssueCredential({ emailVerified }, deployment)) {
    const refusal = AuthErrors.EMAIL_VERIFICATION_REQUIRED;
    throw new APIError('FORBIDDEN', {
      code: refusal.code,
      message: refusal.message,
      error: 'access_denied',
      error_description: refusal.message,
    });
  }

  // A session is never older than a reset: the reset deletes every session.
  if (step.by === 'session') return;
  if (predatesCutoff(owner.authorizedAt, await lookups.credentialCutoff(owner.userId))) {
    throw new APIError('UNAUTHORIZED', {
      error: 'invalid_grant',
      error_description: 'This grant was issued before the account’s password was reset',
    });
  }
}

/**
 * The owner of an authorization code, from the `verification` row the MCP
 * plugin wrote for it: a JSON value carrying `userId` and `authTime` (the
 * authorizing session's creation, in milliseconds).
 */
export function codeOwnerOfVerification(row: {
  value: string;
  createdAt?: Date | string | null;
}): GrantOwner | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    return null;
  }
  const value = (parsed ?? {}) as { userId?: unknown; authTime?: unknown };
  if (typeof value.userId !== 'string') return null;
  const authorizedAt =
    typeof value.authTime === 'number' && Number.isFinite(value.authTime)
      ? new Date(value.authTime)
      : row.createdAt
        ? new Date(row.createdAt)
        : null;
  return { userId: value.userId, authorizedAt };
}

async function sessionOwner(lookups: GrantOwnerLookups): Promise<GrantOwner | null> {
  const userId = await lookups.sessionUserId();
  return userId ? { userId, authorizedAt: null } : null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new APIError('BAD_REQUEST', {
    error: 'invalid_request',
    error_description: `${field} must be a string`,
  });
}

/**
 * The token endpoint takes a form body as well as JSON. Better Auth hands the
 * hook a urlencoded body already parsed into an object of strings; a
 * `FormData` is read the way the plugin reads it.
 */
function formFields(body: unknown): Record<string, unknown> {
  if (body instanceof FormData) return Object.fromEntries(body.entries());
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}
