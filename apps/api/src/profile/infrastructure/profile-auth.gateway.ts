import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { DELEGATED_SESSION } from '../../auth/auth.di-tokens';
import { auth } from '../../auth/infrastructure/better-auth.config';
import { betterAuthHeaders } from '../../auth/infrastructure/better-auth.util';
import type { DelegatedSessionPort } from '../../auth/infrastructure/delegated-session.port';
import { invokeProfileApi } from '../profile-error.mapper';
import type { ChangePasswordInput, ProfileAuthPort } from './profile-auth.port';

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
 * Better Auth deletes the session rows, but `DelegatedSessionAdapter` holds the
 * token for a scoped credential for ten minutes; without the eviction the
 * credential keeps presenting a token that no longer exists and every façade
 * call fails until the cache expires.
 */
@Injectable()
export class ProfileAuthGateway implements ProfileAuthPort {
  constructor(
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

  async changePassword(headers: IncomingHttpHeaders, input: ChangePasswordInput): Promise<void> {
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
