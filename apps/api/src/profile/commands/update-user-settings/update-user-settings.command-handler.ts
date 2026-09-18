import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { UserSettingsRepositoryPort } from '../../database/user-settings.repository.port';
import { UserSettingsEntity } from '../../domain/user-settings.entity';
import { USER_SETTINGS_REPOSITORY } from '../../profile.di-tokens';
import { UpdateUserSettingsCommand } from './update-user-settings.command';

/**
 * Saves a user's preferences, creating the record if this is their first save.
 *
 * Starting from the defaults when no row exists — rather than failing — is what
 * lets sign-up skip provisioning a settings row for every account that may
 * never touch the settings pane.
 */
@CommandHandler(UpdateUserSettingsCommand)
export class UpdateUserSettingsCommandHandler
  implements ICommandHandler<UpdateUserSettingsCommand, AggregateID>
{
  constructor(
    @Inject(USER_SETTINGS_REPOSITORY)
    private readonly settingsRepository: UserSettingsRepositoryPort,
  ) {}

  async execute(command: UpdateUserSettingsCommand): Promise<AggregateID> {
    const found = await this.settingsRepository.findOneById(command.userId);
    const settings = found.unwrapOr(UserSettingsEntity.createDefault(command.userId));

    settings.update({
      theme: command.theme,
      locale: command.locale,
      density: command.density,
      weeklyDigest: command.weeklyDigest,
      productUpdates: command.productUpdates,
    });

    await this.settingsRepository.save(settings);
    return settings.id;
  }
}
