export interface DelegatedSessionRequest {
  credentialId: string;
  userId: string;
  /** Human-readable name for the credential, recorded on the session row. */
  label: string;
  /** Set as the session's active organization, when the credential pins one. */
  activeOrganizationId?: string | null;
}

/**
 * Lets a scoped credential act as the person who issued it.
 *
 * An API token or OAuth grant carries no session, but the operations delegated
 * to the identity provider resolve their caller from one. This mints and
 * reuses a short-lived session for that credential, and invalidates it when the
 * credential or the person's sessions go away.
 */
export interface DelegatedSessionPort {
  /**
   * A session token acting as `userId`, reused across requests from the same
   * credential. Returns `null` if one could not be minted — callers fall back
   * to scope-only access rather than failing a request that may never need it.
   */
  resolveSessionToken(request: DelegatedSessionRequest): Promise<string | null>;

  /** Drop the session held for one credential, e.g. when it is revoked. */
  invalidate(credentialId: string, userId: string): Promise<void>;

  invalidateForUser(userId: string): Promise<void>;
}
