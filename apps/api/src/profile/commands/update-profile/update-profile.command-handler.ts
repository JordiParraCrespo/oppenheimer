import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { UserErrors } from '../../../users/domain/user.errors';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import { UpdateProfileCommand } from './update-profile.command';

/**
 * Applies a user's edits to their own profile.
 *
 * The command carries no `role` or `isActive`, so this can never be the path by
 * which someone promotes themselves — the fields simply are not reachable from
 * here, rather than being filtered out somewhere downstream.
 *
 * A username is unique across accounts. The lookup below is what turns a
 * taken one into `USER_002`; the unique constraint is what holds when two
 * requests race past it, and the repository reports that as the same error.
 */
@CommandHandler(UpdateProfileCommand)
export class UpdateProfileCommandHandler
  implements ICommandHandler<UpdateProfileCommand, AggregateID>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<AggregateID> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(ProfileErrors.NOT_FOUND);

    const user = found.unwrap();
    if (command.username && command.username !== user.username) {
      const holder = await this.userRepository.findOneByUsername(command.username);
      if (holder.isSome()) throw new AppError(UserErrors.USERNAME_TAKEN);
    }

    user.updateProfile({
      firstName: command.firstName,
      lastName: command.lastName,
      phone: command.phone,
      jobTitle: command.jobTitle,
      username: command.username,
    });

    await this.userRepository.save(user);
    return user.id;
  }
}
