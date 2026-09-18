import type { IncomingHttpHeaders } from 'node:http';

/** An OAuth access grant the identity provider recognised. */
export interface VerifiedOAuthGrant {
  userId: string;
  /** The raw access token, for deriving a stable credential id by digest. */
  accessToken: string;
  /** Space-delimited scope string as granted at consent. */
  scopes: string | null | undefined;
  accessTokenExpiresAt: Date | string | null | undefined;
}

/**
 * Verifies a credential a request presents, against whoever issues them.
 *
 * This is the seam the rest of the application asks "is this real, and whose
 * is it?" through. The identity provider's method names, its header shape and
 * its error vocabulary stop here: `CredentialScopeResolver` composes the
 * answers into a scope context and never learns which provider gave them.
 *
 * Both methods answer `null` for "not this kind of credential" rather than
 * throwing, because a request may legitimately carry none of them.
 */
export interface CredentialVerifierPort {
  /** The OAuth grant these headers carry, or `null` if they carry none. */
  verifyOAuthGrant(headers: IncomingHttpHeaders): Promise<VerifiedOAuthGrant | null>;

  /**
   * Whether these headers carry a session the provider recognises.
   *
   * A bearer credential that is neither an API token nor an OAuth grant is
   * only acceptable if it is a session token — that is how the mobile app and
   * the CLI's sign-in flow authenticate.
   */
  hasValidSession(headers: IncomingHttpHeaders): Promise<boolean>;
}
