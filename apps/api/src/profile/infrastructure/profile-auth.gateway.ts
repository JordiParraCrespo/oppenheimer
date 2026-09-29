import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionCachePort } from '../../auth/application/session-cache.port';
import { DELEGATED_SESSION, SESSION_CACHE } from '../../auth/auth.di-tokens';
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
    @Inject(SESSION_CACHE)
    private readonly sessionCache: SessionCachePort,
  ) {}

  async changePassword(
    headers: IncomingHttpHeaders,
    input: ChangePasswordInput,
  ): Promise<string[]> {
    // `returnHeaders`: revoking the other sessions deletes this one too and
    // issues a replacement, and the replacement only exists as a `Set-Cookie`
    // on Better Auth's response. Dropping it signed the browser out of the
    // device it had just changed the password on.
    const { headers: outHeaders } = await invokeProfileApi(() =>
      auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: input.revokeOtherSessions,
        },
        headers: betterAuthHeaders(headers),
        returnHeaders: true,
      }),
    );

    // Only when the call actually swept the other sessions — a password change
    // that keeps them has nothing to evict.
    if (input.revokeOtherSessions) {
      await this.delegatedSessions.invalidateForUser(input.userId);
    }
    return outHeaders.getSetCookie();
  }

  /**
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

  /**
   * Better Auth finds "the other sessions" through its session cache's own
   * index, which knows nothing of a session signed in before the cache existed
   * or one whose index entry was lost — and those still work, from Postgres.
   * So the database is swept after it, sparing the current session by id.
   */
  async revokeOtherSessions(
    headers: IncomingHttpHeaders,
    userId: string,
    currentSessionId: string | undefined,
  ): Promise<void> {
    await invokeProfileApi(() =>
      auth.api.revokeOtherSessions({
        headers: betterAuthHeaders(headers),
      }),
    );
    if (currentSessionId) {
      await this.sessionCache.revokeOtherSessions(userId, currentSessionId);
    }

    await this.delegatedSessions.invalidateForUser(userId);
  }

  /**
   * Better Auth mails the link to the new address through the verification
   * email and, once it is followed, writes the address and marks it verified
   * before redirecting to `callbackURL` — a screen the client names, which
   * Better Auth refuses unless it is on a trusted origin.
   */
  async requestEmailChange(
    headers: IncomingHttpHeaders,
    newEmail: string,
    callbackURL?: string,
  ): Promise<void> {
    await invokeProfileApi(() =>
      auth.api.changeEmail({
        body: { newEmail, callbackURL },
        headers: betterAuthHeaders(headers),
      }),
    );
  }
}
