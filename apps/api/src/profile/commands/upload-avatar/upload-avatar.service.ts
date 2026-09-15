import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import { AvatarStorage } from '../../services/avatar.storage';
import { UploadAvatarCommand } from './upload-avatar.command';

/**
 * Stores a new avatar and points the user's profile at it.
 *
 * The new image is written under its own key, the profile is saved, and only
 * then is the old object retired. Every step of that order matters: the new
 * object never overwrites the live one, so a failed save leaves the user
 * looking at exactly the avatar they had; and the old object outlives the write
 * that stopped referencing it, so a failed save never strands the profile on a
 * deleted file. Cleanup itself is best-effort — an orphaned object costs
 * storage, a failed request costs the user their picture.
 */
@CommandHandler(UploadAvatarCommand)
export class UploadAvatarService implements ICommandHandler<UploadAvatarCommand, AggregateID> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly avatars: AvatarStorage,
  ) {}

  async execute(command: UploadAvatarCommand): Promise<AggregateID> {
    const found = await this.userRepository.findOneById(command.userId);
    if (found.isNone()) throw new AppError(ProfileErrors.NOT_FOUND);

    const user = found.unwrap();
    const previousKey = user.avatarUrl;

    const key = await this.avatars.store(
      command.userId,
      command.buffer,
      command.mimeType,
      command.size,
    );

    user.updateProfile({ avatarUrl: key });
    await this.userRepository.save(user);

    if (previousKey && previousKey !== key) {
      await this.avatars.remove(previousKey);
    }

    return user.id;
  }
}
