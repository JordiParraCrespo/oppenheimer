import type { UpdateUserSettingsDto } from '@oppenheimer/shared/schemas/profile';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { UserSettingsEntity } from './user-settings.entity';
import type { UserSettingsRepository } from './user-settings.repository';

@injectable()
export class UserSettingsService {
  constructor(
    @inject(TOKENS.UserSettingsRepository)
    private readonly repository: UserSettingsRepository,
  ) {}

  async get(): Promise<UserSettingsEntity> {
    return this.repository.get();
  }

  async update(dto: UpdateUserSettingsDto): Promise<UserSettingsEntity> {
    return this.repository.update(dto);
  }
}
