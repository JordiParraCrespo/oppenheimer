import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { SessionCachePort } from '../../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../../auth/auth.di-tokens';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import type { UserEntity } from '../../domain/user.entity';
import { UserErrors } from '../../domain/user.errors';
import { USER_REPOSITORY } from '../../user.di-tokens';
import { UpdateUserCommand } from './update-user.command';

/**
 * Better Auth caches each session with a copy of its user, and the session
 * path reads that copy — `isActive` included — so the copies are refreshed
 * once the row is written. A deactivation therefore refuses the account's
 * cookie on its very next request; the outbox then revokes the sessions
 * themselves (`UserDeactivatedDomainEventHandler`).
 */
@CommandHandler(UpdateUserCommand)
export class UpdateUserCommandHandler implements ICommandHandler<UpdateUserCommand, AggregateID> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(SESSION_CACHE)
    private readonly sessionCache: SessionCachePort,
  ) {}

  async execute(command: UpdateUserCommand): Promise<UserEntity> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) {
      throw new AppError({ ...UserErrors.NOT_FOUND, message: `User ${command.userId} not found` });
    }

    const user = found.unwrap();
    user.updateProfile({
      firstName: command.firstName,
      lastName: command.lastName,
      isActive: command.isActive,
    });

    await this.userRepository.save(user);
    await this.sessionCache.refreshUser(user.id);
    // Return the saved user so the controller can skip the follow-up query.
    return user;
  }
}
