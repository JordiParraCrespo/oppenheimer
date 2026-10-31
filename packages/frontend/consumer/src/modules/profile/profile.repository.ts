import {
  heyApiSdk,
  type ProfileResponseDto,
  type UserSessionResponseDto,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
  get(): Promise<ProfileEntity> {
    return callApi(ProfileErrors.FETCH_FAILED, async (api) => {
      return toProfile(await api.body(heyApiSdk.getProfile()));
    });
  }

  update(dto: UpdateProfileDto): Promise<ProfileEntity> {
    return callApi(ProfileErrors.UPDATE_FAILED, async (api) => {
      return toProfile(await api.body(heyApiSdk.updateProfile({ body: dto })));
    });
  }

  uploadAvatar(file: Blob): Promise<ProfileEntity> {
    return callApi(ProfileErrors.UPLOAD_AVATAR_FAILED, async (api) => {
      return toProfile(await api.body(heyApiSdk.uploadAvatar({ body: { file } })));
    });
  }

  deleteAvatar(): Promise<ProfileEntity> {
    return callApi(ProfileErrors.DELETE_AVATAR_FAILED, async (api) => {
      return toProfile(await api.body(heyApiSdk.deleteAvatar()));
    });
  }

  changePassword(dto: ChangeOwnPasswordDto): Promise<void> {
    return callApi(ProfileErrors.CHANGE_PASSWORD_FAILED, async (api) => {
      await api.result(heyApiSdk.changePassword({ body: dto }));
    });
  }

  /**
   * Ask for a link at the new address. The account moves only when it is
   * followed, so nothing on the profile changes here.
   */
  changeEmail(dto: ChangeEmailDto): Promise<void> {
    return callApi(ProfileErrors.CHANGE_EMAIL_FAILED, async (api) => {
      await api.result(heyApiSdk.changeEmail({ body: dto }));
    });
  }

  deleteAccount(dto: DeleteAccountDto): Promise<void> {
    return callApi(ProfileErrors.DELETE_ACCOUNT_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteOwnAccount({ body: dto }));
    });
  }

  getSessions(): Promise<UserSessionEntity[]> {
    return callApi(ProfileErrors.FETCH_SESSIONS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findProfileSessions());
      return data.map(toSession);
    });
  }

  revokeSession(sessionId: string): Promise<void> {
    return callApi(ProfileErrors.REVOKE_SESSION_FAILED, async (api) => {
      await api.result(heyApiSdk.revokeProfileSession({ path: { id: sessionId } }));
    });
  }

  revokeOtherSessions(): Promise<void> {
    return callApi(ProfileErrors.REVOKE_SESSION_FAILED, async (api) => {
      await api.result(heyApiSdk.revokeOtherSessions());
    });
  }
}
