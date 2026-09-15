import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { UserSettingsRepositoryPort } from '../../database/user-settings.repository.port';
import { UserSettingsEntity } from '../../domain/user-settings.entity';
import { USER_SETTINGS_REPOSITORY } from '../../profile.di-tokens';
import { GetUserSettingsQuery } from './get-user-settings.query';

/**
 * Reads a user's preferences, falling back to the defaults when they have never
 * saved any.
 *
 * The fallback is deliberate: no row is created at sign-up, so returning a 404
 * here would make every client implement the same "not found means defaults"
 * branch, and each would have to keep its own copy of what the defaults are.
 */
@QueryHandler(GetUserSettingsQuery)
export class GetUserSettingsQueryHandler
  implements IQueryHandler<GetUserSettingsQuery, UserSettingsEntity>
{
  constructor(
    @Inject(USER_SETTINGS_REPOSITORY)
    private readonly settingsRepository: UserSettingsRepositoryPort,
  ) {}

  async execute(query: GetUserSettingsQuery): Promise<UserSettingsEntity> {
    const found = await this.settingsRepository.findOneById(query.userId);
    return found.unwrapOr(UserSettingsEntity.createDefault(query.userId));
  }
}
