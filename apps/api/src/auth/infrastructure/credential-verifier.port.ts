import type { IncomingHttpHeaders } from 'node:http';
import type { AccountStanding } from '../domain/account-access.policy';

export interface VerifiedOAuthGrant {
  userId: string;
  /** The raw access token, for deriving a stable credential id by digest. */
  accessToken: string;
  /** Space-delimited scope string as granted at consent. */
  scopes: string | null | undefined;
  accessTokenExpiresAt: Date | string | null | undefined;
}

/**
 * A session the identity provider recognised, and the account it belongs to,
 * as the provider holds them — the shape `request.session` / `request.user`
 * are set from on the session path.
 */
export interface VerifiedSession {
  session: { id: string; userId: string; [field: string]: unknown };
  user: { id: string; [field: string]: unknown } & AccountStanding;
}

/**
 * Verifies a credential a request presents, against whoever issues them.
 *
 * This is the seam the rest of the application asks "is this real, and whose
 * is it?" through. The identity provider's method names, its header shape and
 * its error vocabulary stop here: `CredentialScopeResolver` composes the
 * answers into a scope context and never learns which provider gave them.
 *
 * The verifying methods answer `null` for "not this kind of credential" rather
 * than throwing, because a request may legitimately carry none of them.
 */
export interface CredentialVerifierPort {
  verifyOAuthGrant(headers: IncomingHttpHeaders): Promise<VerifiedOAuthGrant | null>;

  /**
   * The session these headers carry — a session cookie, or a session token
   * presented as a bearer credential (the mobile app and the CLI) — or `null`.
   *
   * The session is returned rather than a yes/no so it is verified once per
   * request: the guard that authenticates the request reuses this answer
   * instead of asking the provider again. A provider failure (its store is
   * unreachable) propagates; only "no such session" is a `null`.
   */
  verifySession(headers: IncomingHttpHeaders): Promise<VerifiedSession | null>;

  /**
   * The session token of a correctly signed session cookie, checked against
   * the signing secret **without a lookup**, or `null` when there is none or
   * its signature does not verify. Says nothing about whether the session is
   * still valid — only that the provider issued this token, which is what
   * makes it safe to key a rate-limit bucket on.
   */
  signedSessionCookie(headers: IncomingHttpHeaders): Promise<string | null>;
}
