// The narrow subpath, not the package root: `@oppenheimer/shared`'s CJS build is not
// tree-shakeable by Rollup, so importing these two runtime constants from the
// root would pull CASL and the whole scope catalog into the web bundle. This
// entry reaches nothing but Zod.
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  type ChangeOwnPasswordDto,
  type UpdateProfileDto,
  type UpdateUserSettingsDto,
} from '@oppenheimer/shared/schemas/profile';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { AppError } from '../core/errors';
import type { ProfileEntity, UserSessionEntity, UserSettingsEntity } from './profile.entity';
import { ProfileErrors } from './profile.errors';
import type { ProfileRepository } from './profile.repository';

@injectable()
export class ProfileService {
  constructor(
    @inject(TOKENS.ProfileRepository)
    private readonly profileRepository: ProfileRepository,
  ) {}

  async get(): Promise<ProfileEntity> {
    return this.profileRepository.get();
  }

  async update(dto: UpdateProfileDto): Promise<ProfileEntity> {
    return this.profileRepository.update(dto);
  }

  /**
   * Upload a new avatar.
   *
   * Type and size are checked here as well as on the server so the user is told
   * immediately, without spending an upload to find out — the server check is
   * still the one that decides.
   */
  async uploadAvatar(file: Blob): Promise<ProfileEntity> {
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      throw new AppError(ProfileErrors.AVATAR_TYPE_REJECTED);
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new AppError(ProfileErrors.AVATAR_TOO_LARGE);
    }
    return this.profileRepository.uploadAvatar(file);
  }

  async deleteAvatar(): Promise<ProfileEntity> {
    return this.profileRepository.deleteAvatar();
  }

  async getSettings(): Promise<UserSettingsEntity> {
    return this.profileRepository.getSettings();
  }

  async updateSettings(dto: UpdateUserSettingsDto): Promise<UserSettingsEntity> {
    return this.profileRepository.updateSettings(dto);
  }

  async changePassword(dto: ChangeOwnPasswordDto): Promise<void> {
    return this.profileRepository.changePassword(dto);
  }

  async getSessions(): Promise<UserSessionEntity[]> {
    return this.profileRepository.getSessions();
  }

  async revokeSession(sessionId: string): Promise<void> {
    return this.profileRepository.revokeSession(sessionId);
  }

  async revokeOtherSessions(): Promise<void> {
    return this.profileRepository.revokeOtherSessions();
  }
}
