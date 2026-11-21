import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { VoiceSettingsRepositoryPort } from '../../database/voice-settings.repository.port';
import { VOICE_SETTINGS_REPOSITORY } from '../../voice.di-tokens';
import { UpdateVoiceSettingsCommand } from './update-voice-settings.command';

/**
 * Settings → Model providers, Voice: the workspace's choices, replaced whole.
 * A provider it has no key for yet is taken: it is tried first once the key
 * is there, and the others answer until then. The schema has already held
 * each model and voice to its provider's catalog.
 */
@CommandHandler(UpdateVoiceSettingsCommand)
export class UpdateVoiceSettingsCommandHandler
  implements ICommandHandler<UpdateVoiceSettingsCommand, void>
{
  constructor(
    @Inject(VOICE_SETTINGS_REPOSITORY) private readonly settings: VoiceSettingsRepositoryPort,
  ) {}

  async execute({ organizationId, settings }: UpdateVoiceSettingsCommand): Promise<void> {
    await this.settings.put(organizationId, settings);
  }
}
