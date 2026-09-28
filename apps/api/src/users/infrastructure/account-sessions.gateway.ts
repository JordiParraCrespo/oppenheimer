import { Inject, Injectable } from '@nestjs/common';
import { DELEGATED_SESSION } from '../../auth/auth.di-tokens';
import { auth } from '../../auth/infrastructure/better-auth.config';
import type { DelegatedSessionPort } from '../../auth/infrastructure/delegated-session.port';
import type { AccountSessionsPort } from '../application/account-sessions.port';

/**
 * Revokes an account's sessions with Better Auth, which owns the `session`
 * table (and any secondary storage in front of it), then rotates the user's
 * delegated-session generation so no credential keeps presenting a cached
 * token for a row that no longer exists.
 */
@Injectable()
export class AccountSessionsGateway implements AccountSessionsPort {
  constructor(
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

  async revokeAll(userId: string): Promise<void> {
    const context = await auth.$context;
    // Every session the user holds, devices and delegated bridges alike.
    await context.internalAdapter.deleteUserSessions(userId);
    await this.delegatedSessions.invalidateForUser(userId);
  }
}
