import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import { UserErrors } from '../../domain/user.errors';
import { USER_REPOSITORY } from '../../user.di-tokens';
import { UpdateUserCommand } from './update-user.command';

/**
 * Command handler for updating a user's profile. Loads the aggregate, applies
 * the change through its domain method and persists it.
 */
@CommandHandler(UpdateUserCommand)
export class UpdateUserCommandHandler implements ICommandHandler<UpdateUserCommand, AggregateID> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(command: UpdateUserCommand): Promise<AggregateID> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);

    const user = found.unwrap();
    user.updateProfile({
      firstName: command.firstName,
      lastName: command.lastName,
      isActive: command.isActive,
    });

    await this.userRepository.save(user);
    return user.id;
  }
}
