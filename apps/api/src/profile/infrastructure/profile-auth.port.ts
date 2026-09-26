import type { IncomingHttpHeaders } from 'node:http';

/** What `changePassword` needs to know, independent of who verifies it. */
export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
}

/**
 * What the profile use cases need done to the caller's own credentials.
 *
 * The application's vocabulary is "change this person's password" and "revoke
 * their sessions". That an identity provider owns the password hashing, and
 * that a cached delegated session has to be evicted alongside a bulk
 * revocation, are both facts about the adapter — a handler names neither.
 */
export interface ProfileAuthPort {
  /**
   * Change the caller's password, verifying the current one first.
   *
   * Resolves to the `Set-Cookie` values the caller's client must store. When
   * the other sessions are revoked the one making the request is replaced as
   * well, and a client left holding the old cookie is signed out on its next
   * request — so these have to reach it.
   */
  changePassword(headers: IncomingHttpHeaders, input: ChangePasswordInput): Promise<string[]>;

  /**
   * Revoke one session by its token. The token is never accepted from a
   * client: the caller names a session by id and the repository resolves it.
   */
  revokeSession(headers: IncomingHttpHeaders, token: string): Promise<void>;

  /** Revoke every session except the one this request was made with. */
  revokeOtherSessions(headers: IncomingHttpHeaders, userId: string): Promise<void>;

  /**
   * Send a link to `newEmail` that moves the caller's account there when it
   * is followed. Nothing changes until then.
   */
  requestEmailChange(headers: IncomingHttpHeaders, newEmail: string): Promise<void>;
}
