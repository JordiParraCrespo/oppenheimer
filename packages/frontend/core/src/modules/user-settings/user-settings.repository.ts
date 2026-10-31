import { heyApiSdk, type UserSettingsResponseDto } from '@oppenheimer/api-client';
import { injectable } from 'inversify';
import { callApi } from '../core/errors';

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
  get(): Promise<UserSettingsEntity> {
    return callApi(UserSettingsErrors.FETCH_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.getUserSettings());
      return toSettings(data);
    });
  }
}
