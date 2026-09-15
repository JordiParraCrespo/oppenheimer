import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import { auth } from '../../auth/auth';
import { betterAuthHeaders } from '../../auth/better-auth.util';
import { DelegatedSessionService } from '../../auth/services/delegated-session.service';
import { invokeProfileApi } from '../profile-error.mapper';

/**
 * Delegating façade over the Better Auth operations that act on the caller's
 * own credentials: changing a password, and revoking sessions.
 *
 * Better Auth owns the `account` and `session` tables and the hashing scheme,
 * so these are delegated rather than re-implemented — writing the tables here
 * would mean owning password hashing and session invalidation in two places.
 * Every call goes through `invokeProfileApi`, which folds Better Auth's errors
 * onto this module's catalog.
 *
 * Bulk revocation additionally evicts the caller's cached delegated sessions.
 * Better Auth deletes the session rows, but `DelegatedSessionService` holds the
 * token for a scoped credential for ten minutes; without the eviction the
 * credential keeps presenting a token that no longer exists and every façade
 * call fails until the cache expires.
 */
@Injectable()
export class ProfileAuthFacade {
  constructor(private readonly delegatedSessions: DelegatedSessionService) {}

  async changePassword(
    headers: IncomingHttpHeaders,
    input: {
      userId: string;
      currentPassword: string;
      newPassword: string;
      revokeOtherSessions: boolean;
    },
  ): Promise<void> {
    await invokeProfileApi(() =>
      auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: input.revokeOtherSessions,
        },
        headers: betterAuthHeaders(headers),
      }),
    );

    // Only when the call actually swept the other sessions — a password change
    // that keeps them has nothing to evict.
    if (input.revokeOtherSessions) {
      await this.delegatedSessions.invalidateForUser(input.userId);
    }
  }

  /**
   * Revoke one session by its token. The token is never accepted from a client
   * — the caller names a session by id and the repository resolves it, after
   * the handler has checked the session is theirs.
   *
   * No eviction here: a single revocation names a device session, and a
   * delegated session is not one — it is minted per credential and never
   * appears to the user as a device they chose to sign out.
   */
  async revokeSession(headers: IncomingHttpHeaders, token: string): Promise<void> {
    await invokeProfileApi(() =>
      auth.api.revokeSession({
        body: { token },
        headers: betterAuthHeaders(headers),
      }),
    );
  }

  /** Revoke every session except the one this request was made with. */
  async revokeOtherSessions(headers: IncomingHttpHeaders, userId: string): Promise<void> {
    await invokeProfileApi(() =>
      auth.api.revokeOtherSessions({
        headers: betterAuthHeaders(headers),
      }),
    );

    await this.delegatedSessions.invalidateForUser(userId);
  }
}
