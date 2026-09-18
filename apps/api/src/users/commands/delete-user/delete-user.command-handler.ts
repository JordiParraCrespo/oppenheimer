import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import { UserErrors } from '../../domain/user.errors';
import { USER_REPOSITORY } from '../../user.di-tokens';
import { DeleteUserCommand } from './delete-user.command';

/**
 * Command handler for deleting a user. The aggregate raises a
 * `UserDeletedDomainEvent`, which the repository publishes after the delete.
 */
@CommandHandler(DeleteUserCommand)
export class DeleteUserCommandHandler implements ICommandHandler<DeleteUserCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);

    const user = found.unwrap();
    user.delete();
    await this.userRepository.delete(user);
  }
}
