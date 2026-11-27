import { APIError } from 'better-auth/api';
import { AuthErrors } from '../domain/auth.errors';
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

/** Which grant step this Better Auth request is, if any. */
export function grantStepOf(path: string | undefined, body: unknown): GrantStep | null {
  const fields = formFields(body);
  if (path === '/oauth2/consent') return fields.accept === true ? { by: 'session' } : null;
  if (path !== '/mcp/token') return null;

  if (fields.grant_type === 'authorization_code' && typeof fields.code === 'string') {
    return { by: 'authorization-code', code: fields.code };
  }
  if (fields.grant_type === 'refresh_token' && typeof fields.refresh_token === 'string') {
    return { by: 'refresh-token', refreshToken: fields.refresh_token };
  }
  return null;
}

/** What the gate reads; each answers `null` when it finds nothing. */
export interface GrantOwnerLookups {
  sessionUserId(): Promise<string | null>;
  codeUserId(code: string): Promise<string | null>;
  refreshTokenUserId(refreshToken: string): Promise<string | null>;
  emailVerified(userId: string): Promise<boolean | null>;
}

/**
 * Refuse the step when its account has not verified its email, with the
 * `TOKEN_010` the console's consent screen translates and the OAuth
 * `access_denied` a client reads. A step whose account cannot be found is left
 * to Better Auth, which refuses an unknown code or token on its own terms.
 */
export async function refuseUnverifiedGrant(
  step: GrantStep,
  lookups: GrantOwnerLookups,
): Promise<void> {
  const userId =
    step.by === 'session'
      ? await lookups.sessionUserId()
      : step.by === 'authorization-code'
        ? await lookups.codeUserId(step.code)
        : await lookups.refreshTokenUserId(step.refreshToken);
  if (!userId) return;

  if (mayIssueCredential({ emailVerified: await lookups.emailVerified(userId) })) return;

  const refusal = AuthErrors.EMAIL_VERIFICATION_REQUIRED;
  throw new APIError('FORBIDDEN', {
    code: refusal.code,
    message: refusal.message,
    error: 'access_denied',
    error_description: refusal.message,
  });
}

/** The user id an authorization code's verification row was written for. */
export function userIdOfCodeValue(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    const userId = (parsed as { userId?: unknown } | null)?.userId;
    return typeof userId === 'string' ? userId : null;
  } catch {
    return null;
  }
}

/** The token endpoint takes a form body as well as JSON. */
function formFields(body: unknown): Record<string, unknown> {
  if (body instanceof FormData) return Object.fromEntries(body.entries());
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}
