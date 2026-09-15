import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionReaderPort } from '../../database/session.repository.port';
import { ProfileErrors } from '../../domain/profile.errors';
import { SESSION_READER } from '../../profile.di-tokens';
import { ProfileAuthFacade } from '../../services/profile-auth.facade';
import { RevokeSessionCommand } from './revoke-session.command';

/**
 * Signs one of the caller's devices out.
 *
 * Someone else's session is reported as **not found** rather than forbidden, so
 * the endpoint cannot be used to confirm that a session id exists — the same
 * reasoning as the api-tokens module's ownership check.
 */
@CommandHandler(RevokeSessionCommand)
export class RevokeSessionService implements ICommandHandler<RevokeSessionCommand, void> {
  constructor(
    @Inject(SESSION_READER)
    private readonly sessions: SessionReaderPort,
    private readonly profileAuth: ProfileAuthFacade,
  ) {}

  async execute(command: RevokeSessionCommand): Promise<void> {
    if (command.currentSessionId && command.sessionId === command.currentSessionId) {
      throw new AppError(ProfileErrors.CANNOT_REVOKE_CURRENT_SESSION, {
        detail: 'Use sign-out to end the session you are currently using.',
      });
    }

    const found = await this.sessions.findOneById(command.sessionId);
    if (found.isNone()) throw new AppError(ProfileErrors.SESSION_NOT_FOUND);

    const session = found.unwrap();
    if (session.userId !== command.userId) {
      throw new AppError(ProfileErrors.SESSION_NOT_FOUND);
    }

    await this.profileAuth.revokeSession(command.headers, session.token);
  }
}
