import {
  heyApiSdk,
  type ProfileResponseDto,
  type UserSessionResponseDto,
} from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
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
    return toProfile(await unwrapBody(heyApiSdk.getProfile(), ProfileErrors.FETCH_FAILED));
  }

  @MapApiError(ProfileErrors.UPDATE_FAILED)
  async update(dto: UpdateProfileDto): Promise<ProfileEntity> {
    return toProfile(
      await unwrapBody(heyApiSdk.updateProfile({ body: dto }), ProfileErrors.UPDATE_FAILED),
    );
  }

  @MapApiError(ProfileErrors.UPLOAD_AVATAR_FAILED)
  async uploadAvatar(file: Blob): Promise<ProfileEntity> {
    return toProfile(
      await unwrapBody(
        heyApiSdk.uploadAvatar({ body: { file } }),
        ProfileErrors.UPLOAD_AVATAR_FAILED,
      ),
    );
  }

  @MapApiError(ProfileErrors.DELETE_AVATAR_FAILED)
  async deleteAvatar(): Promise<ProfileEntity> {
    return toProfile(
      await unwrapBody(heyApiSdk.deleteAvatar(), ProfileErrors.DELETE_AVATAR_FAILED),
    );
  }

  @MapApiError(ProfileErrors.CHANGE_PASSWORD_FAILED)
  async changePassword(dto: ChangeOwnPasswordDto): Promise<void> {
    await unwrap(heyApiSdk.changePassword({ body: dto }), ProfileErrors.CHANGE_PASSWORD_FAILED);
  }

  /**
   * Ask for a link at the new address. The account moves only when it is
   * followed, so nothing on the profile changes here.
   */
  @MapApiError(ProfileErrors.CHANGE_EMAIL_FAILED)
  async changeEmail(dto: ChangeEmailDto): Promise<void> {
    await unwrap(heyApiSdk.changeEmail({ body: dto }), ProfileErrors.CHANGE_EMAIL_FAILED);
  }

  @MapApiError(ProfileErrors.DELETE_ACCOUNT_FAILED)
  async deleteAccount(dto: DeleteAccountDto): Promise<void> {
    await unwrap(heyApiSdk.deleteOwnAccount({ body: dto }), ProfileErrors.DELETE_ACCOUNT_FAILED);
  }

  @MapApiError(ProfileErrors.FETCH_SESSIONS_FAILED)
  async getSessions(): Promise<UserSessionEntity[]> {
    const data = await unwrapBody(heyApiSdk.findSessions(), ProfileErrors.FETCH_SESSIONS_FAILED);
    return data.map(toSession);
  }

  @MapApiError(ProfileErrors.REVOKE_SESSION_FAILED)
  async revokeSession(sessionId: string): Promise<void> {
    await unwrap(
      heyApiSdk.revokeProfileSession({ path: { id: sessionId } }),
      ProfileErrors.REVOKE_SESSION_FAILED,
    );
  }

  @MapApiError(ProfileErrors.REVOKE_SESSION_FAILED)
  async revokeOtherSessions(): Promise<void> {
    await unwrap(heyApiSdk.revokeOtherSessions(), ProfileErrors.REVOKE_SESSION_FAILED);
  }
}
