import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BOT_PROVIDERS, type VoiceSettingsDto } from '@oppenheimer/shared';
import type { TurnCredentialsPort } from '../../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../../bots/bots.di-tokens';
import { SpeechProviderRegistry } from '../../application/speech-provider.registry';
import { SynthesisProviderRegistry } from '../../application/synthesis-provider.registry';
import type { VoiceSettingsRepositoryPort } from '../../database/voice-settings.repository.port';
import { VOICE_SETTINGS_REPOSITORY } from '../../voice.di-tokens';
import { VoiceSettingsMapper } from '../../voice-settings.mapper';
import { FindVoiceSettingsQuery } from './find-voice-settings.query';

/**
 * The workspace's voice choices, and what it can choose from now: the
 * registries' own answers for hearing and speaking, and the bot providers it
 * holds a credential for to tidy with. Rows and config only; no provider is
 * called.
 */
@QueryHandler(FindVoiceSettingsQuery)
export class FindVoiceSettingsQueryHandler
  implements IQueryHandler<FindVoiceSettingsQuery, VoiceSettingsDto>
{
  constructor(
    @Inject(VOICE_SETTINGS_REPOSITORY) private readonly settings: VoiceSettingsRepositoryPort,
    private readonly hearing: SpeechProviderRegistry,
    private readonly speaking: SynthesisProviderRegistry,
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
  ) {}

  async execute({ organizationId }: FindVoiceSettingsQuery): Promise<VoiceSettingsDto> {
    const [settings, transcription, synthesis, held] = await Promise.all([
      this.settings.find(organizationId),
      this.hearing.availableFor(organizationId),
      this.speaking.availableFor(organizationId),
      Promise.all(BOT_PROVIDERS.map((provider) => this.credentials.has(organizationId, provider))),
    ]);
    return VoiceSettingsMapper.toResponse(settings, {
      transcription: transcription.map((provider) => provider.id),
      synthesis: synthesis.map((provider) => provider.id),
      polish: VoiceSettingsMapper.polishProviders(held),
    });
  }
}
