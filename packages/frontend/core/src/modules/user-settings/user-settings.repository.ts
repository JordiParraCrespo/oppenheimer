import { heyApiSdk, type UserSettingsResponseDto } from '@oppenheimer/api-client';
import type { UpdateUserSettingsDto } from '@oppenheimer/shared/schemas/profile';
import { injectable } from 'inversify';
import { unwrapBody } from '../core/errors';
import { MapApiError } from '../core/map-api-error.decorator';
import { UserSettingsEntity } from './user-settings.entity';
import { UserSettingsErrors } from './user-settings.errors';

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

@injectable()
export class UserSettingsRepository {
  @MapApiError(UserSettingsErrors.FETCH_FAILED)
  async get(): Promise<UserSettingsEntity> {
    const data = await unwrapBody(heyApiSdk.getSettings(), UserSettingsErrors.FETCH_FAILED);
    return toSettings(data);
  }

  @MapApiError(UserSettingsErrors.UPDATE_FAILED)
  async update(dto: UpdateUserSettingsDto): Promise<UserSettingsEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateSettings({ body: dto }),
      UserSettingsErrors.UPDATE_FAILED,
    );
    return toSettings(data);
  }
}
