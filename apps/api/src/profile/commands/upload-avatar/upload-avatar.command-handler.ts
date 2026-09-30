import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { SessionCachePort } from '../../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../../auth/auth.di-tokens';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import type { AvatarStoragePort } from '../../infrastructure/avatar-storage.port';
import { AVATAR_STORAGE } from '../../profile.di-tokens';
import { UploadAvatarCommand } from './upload-avatar.command';

/**
 * The new image is written under its own key (see `AvatarStorageAdapter.store`),
 * the profile is saved, and only then is the old object retired, so a failed
 * save never strands the profile on a deleted file. Cleanup itself is
 * best-effort — an orphaned object costs storage, a failed request costs the
 * user their picture.
 */
@CommandHandler(UploadAvatarCommand)
export class UploadAvatarCommandHandler
  implements ICommandHandler<UploadAvatarCommand, AggregateID>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(AVATAR_STORAGE)
    private readonly avatars: AvatarStoragePort,
    @Inject(SESSION_CACHE)
    private readonly sessionCache: SessionCachePort,
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
    await this.sessionCache.refreshUser(user.id);

    if (previousKey && previousKey !== key) {
      await this.avatars.remove(previousKey);
    }

    return user.id;
  }
}
