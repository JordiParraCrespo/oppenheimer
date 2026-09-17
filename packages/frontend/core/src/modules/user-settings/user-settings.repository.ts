import { ProfileApi, type UserSettingsResponseDto } from '@oppenheimer/api-client';
import type { UpdateUserSettingsDto } from '@oppenheimer/shared/schemas/profile';
import { injectable } from 'inversify';
import { AppError } from '../core/errors';
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
    const data = await ProfileApi.getSettings();
    if (!data) throw new AppError(UserSettingsErrors.FETCH_FAILED);
    return toSettings(data);
  }

  @MapApiError(UserSettingsErrors.UPDATE_FAILED)
  async update(dto: UpdateUserSettingsDto): Promise<UserSettingsEntity> {
    const data = await ProfileApi.updateSettings(dto);
    if (!data) throw new AppError(UserSettingsErrors.UPDATE_FAILED);
    return toSettings(data);
  }
}
