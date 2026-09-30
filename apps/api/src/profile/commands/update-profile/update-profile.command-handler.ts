import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { SessionCachePort } from '../../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../../auth/auth.di-tokens';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import { UpdateProfileCommand } from './update-profile.command';

/**
 * A username is unique across accounts. The unique constraint is the rule,
 * and the repository reports a violation as `USER_002`.
 */
@CommandHandler(UpdateProfileCommand)
export class UpdateProfileCommandHandler
  implements ICommandHandler<UpdateProfileCommand, AggregateID>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(SESSION_CACHE)
    private readonly sessionCache: SessionCachePort,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<AggregateID> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(ProfileErrors.NOT_FOUND);

    const user = found.unwrap();
    user.updateProfile({
      firstName: command.firstName,
      lastName: command.lastName,
      phone: command.phone,
      jobTitle: command.jobTitle,
      username: command.username,
    });

    await this.userRepository.save(user);
    await this.sessionCache.refreshUser(user.id);
    return user.id;
  }
}
