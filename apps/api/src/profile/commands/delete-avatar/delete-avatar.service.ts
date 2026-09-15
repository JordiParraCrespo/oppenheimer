import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import { AvatarStorage } from '../../services/avatar.storage';
import { DeleteAvatarCommand } from './delete-avatar.command';

/**
 * Clears the caller's avatar, falling the UI back to their initials.
 *
 * The profile is saved before the object is removed, so a storage failure
 * cannot leave a profile pointing at a deleted file. Clearing an avatar that is
 * already absent succeeds — the caller asked for a state, not for an event.
 */
@CommandHandler(DeleteAvatarCommand)
export class DeleteAvatarService implements ICommandHandler<DeleteAvatarCommand, AggregateID> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly avatars: AvatarStorage,
  ) {}

  async execute(command: DeleteAvatarCommand): Promise<AggregateID> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(ProfileErrors.NOT_FOUND);

    const user = found.unwrap();
    const previousKey = user.avatarUrl;

    user.updateProfile({ avatarUrl: null });
    await this.userRepository.save(user);
    await this.avatars.remove(previousKey);

    return user.id;
  }
}
