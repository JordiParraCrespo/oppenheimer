import {
  ProfileApi,
  type ProfileResponseDto,
  type UserSessionResponseDto,
  type UserSettingsResponseDto,
} from '@oppenheimer/api-client';
import type {
  ChangeOwnPasswordDto,
  UpdateProfileDto,
  UpdateUserSettingsDto,
} from '@oppenheimer/shared/schemas/profile';
import { injectable } from 'inversify';
import { AppError } from '../core/errors';
import { MapApiError } from '../core/map-api-error.decorator';
import { ProfileEntity, UserSessionEntity, UserSettingsEntity } from './profile.entity';
import { ProfileErrors } from './profile.errors';

function toProfile(data: ProfileResponseDto): ProfileEntity {
  return new ProfileEntity(
    data.id,
    data.email,
    data.firstName,
    data.lastName,
    data.phone,
    data.jobTitle,
    data.avatarUrl,
    data.role,
    data.emailVerified,
    data.twoFactorEnabled,
    new Date(data.createdAt),
    new Date(data.updatedAt),
  );
}

function toSettings(data: UserSettingsResponseDto): UserSettingsEntity {
  return new UserSettingsEntity(
    data.userId,
    data.theme,
    data.locale,
    data.density,
    data.weeklyDigest,
    data.productUpdates,
    new Date(data.createdAt),
    new Date(data.updatedAt),
  );
}

function toSession(data: UserSessionResponseDto): UserSessionEntity {
  return new UserSessionEntity(
    data.id,
    data.ipAddress,
    data.userAgent,
    data.current,
    new Date(data.createdAt),
    // The API's `updatedAt` on a session is when it was last seen; the entity
    // says so, rather than making every screen remember the translation.
    new Date(data.updatedAt),
    new Date(data.expiresAt),
  );
}

@injectable()
export class ProfileRepository {
  @MapApiError(ProfileErrors.FETCH_FAILED)
  async get(): Promise<ProfileEntity> {
    const data = await ProfileApi.getProfile();
    if (!data) throw new AppError(ProfileErrors.FETCH_FAILED);
    return toProfile(data);
  }

  @MapApiError(ProfileErrors.UPDATE_FAILED)
  async update(dto: UpdateProfileDto): Promise<ProfileEntity> {
    const data = await ProfileApi.updateProfile(dto);
    if (!data) throw new AppError(ProfileErrors.UPDATE_FAILED);
    return toProfile(data);
  }

  @MapApiError(ProfileErrors.UPLOAD_AVATAR_FAILED)
  async uploadAvatar(file: Blob): Promise<ProfileEntity> {
    const data = await ProfileApi.uploadAvatar({ file });
    if (!data) throw new AppError(ProfileErrors.UPLOAD_AVATAR_FAILED);
    return toProfile(data);
  }

  @MapApiError(ProfileErrors.DELETE_AVATAR_FAILED)
  async deleteAvatar(): Promise<ProfileEntity> {
    const data = await ProfileApi.deleteAvatar();
    if (!data) throw new AppError(ProfileErrors.DELETE_AVATAR_FAILED);
    return toProfile(data);
  }

  @MapApiError(ProfileErrors.FETCH_SETTINGS_FAILED)
  async getSettings(): Promise<UserSettingsEntity> {
    const data = await ProfileApi.getSettings();
    if (!data) throw new AppError(ProfileErrors.FETCH_SETTINGS_FAILED);
    return toSettings(data);
  }

  @MapApiError(ProfileErrors.UPDATE_SETTINGS_FAILED)
  async updateSettings(dto: UpdateUserSettingsDto): Promise<UserSettingsEntity> {
    const data = await ProfileApi.updateSettings(dto);
    if (!data) throw new AppError(ProfileErrors.UPDATE_SETTINGS_FAILED);
    return toSettings(data);
  }

  @MapApiError(ProfileErrors.CHANGE_PASSWORD_FAILED)
  async changePassword(dto: ChangeOwnPasswordDto): Promise<void> {
    await ProfileApi.changePassword(dto);
  }

  @MapApiError(ProfileErrors.FETCH_SESSIONS_FAILED)
  async getSessions(): Promise<UserSessionEntity[]> {
    const data = await ProfileApi.findSessions();
    return (data ?? []).map(toSession);
  }

  @MapApiError(ProfileErrors.REVOKE_SESSION_FAILED)
  async revokeSession(sessionId: string): Promise<void> {
    await ProfileApi.revokeSession(sessionId);
  }

  @MapApiError(ProfileErrors.REVOKE_SESSION_FAILED)
  async revokeOtherSessions(): Promise<void> {
    await ProfileApi.revokeOtherSessions();
  }
}
