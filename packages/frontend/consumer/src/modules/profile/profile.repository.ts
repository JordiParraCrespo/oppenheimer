import {
  heyApiSdk,
  ProfileApi,
  type ProfileResponseDto,
  type UserSessionResponseDto,
} from '@oppenheimer/api-client';
import { AppError, MapApiError, toAppError } from '@oppenheimer/frontend-core';
import type {
  ChangeEmailDto,
  ChangeOwnPasswordDto,
  DeleteAccountDto,
  UpdateProfileDto,
} from '@oppenheimer/shared/schemas/profile';
import { injectable } from 'inversify';
import { ProfileEntity, UserSessionEntity } from './profile.entity';
import { ProfileErrors } from './profile.errors';

function toProfile(data: ProfileResponseDto): ProfileEntity {
  return new ProfileEntity(
    data.id,
    data.email,
    data.firstName,
    data.lastName,
    data.phone,
    data.jobTitle,
    data.username ?? null,
    data.avatarUrl,
    data.role,
    data.emailVerified,
    data.twoFactorEnabled,
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

  @MapApiError(ProfileErrors.CHANGE_PASSWORD_FAILED)
  async changePassword(dto: ChangeOwnPasswordDto): Promise<void> {
    await ProfileApi.changePassword(dto);
  }

  /**
   * Ask for a link at the new address. The account moves only when it is
   * followed, so nothing on the profile changes here.
   *
   * These two calls go through the generated SDK rather than the retired
   * `ProfileApi` above, which predates them; `toAppError` keeps the problem
   * document the API sent, so a wrong confirmation reads as that and not as a
   * generic failure.
   */
  @MapApiError(ProfileErrors.CHANGE_EMAIL_FAILED)
  async changeEmail(dto: ChangeEmailDto): Promise<void> {
    const { error, response } = await heyApiSdk.changeEmail({ body: dto });
    if (error) {
      throw toAppError(
        { status: response?.status, body: error },
        ProfileErrors.CHANGE_EMAIL_FAILED,
      );
    }
  }

  @MapApiError(ProfileErrors.DELETE_ACCOUNT_FAILED)
  async deleteAccount(dto: DeleteAccountDto): Promise<void> {
    const { error, response } = await heyApiSdk.deleteAccount({ body: dto });
    if (error) {
      throw toAppError(
        { status: response?.status, body: error },
        ProfileErrors.DELETE_ACCOUNT_FAILED,
      );
    }
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
