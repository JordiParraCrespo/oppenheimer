import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import { UpdateProfileCommand } from './update-profile.command';

/**
 * Applies a user's edits to their own profile.
 *
 * The command carries no `role` or `isActive`, so this can never be the path by
 * which someone promotes themselves — the fields simply are not reachable from
 * here, rather than being filtered out somewhere downstream.
 */
@CommandHandler(UpdateProfileCommand)
export class UpdateProfileService implements ICommandHandler<UpdateProfileCommand, AggregateID> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
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
    });

    await this.userRepository.save(user);
    return user.id;
  }
}
