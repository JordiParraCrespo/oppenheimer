import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { VoiceStatusDto } from '@oppenheimer/shared';
import { SpeechProviderRegistry } from '../../application/speech-provider.registry';
import type { LiveSpeechPort } from '../../infrastructure/speech-to-text.port';
import { LIVE_SPEECH } from '../../voice.di-tokens';
import { VoiceTranscriptionMapper } from '../../voice-transcription.mapper';
import { FindVoiceStatusQuery } from './find-voice-status.query';

/**
 * Whether the workspace can dictate, and on which providers in the order a
 * dictation tries them: the registry's own answer, so a provider added there
 * shows the console's mic with no change here or in the console. `live`
 * says whether the words can also show while they are spoken.
 */
@QueryHandler(FindVoiceStatusQuery)
export class FindVoiceStatusQueryHandler
  implements IQueryHandler<FindVoiceStatusQuery, VoiceStatusDto>
{
  constructor(
    private readonly registry: SpeechProviderRegistry,
    @Inject(LIVE_SPEECH) private readonly live: LiveSpeechPort,
  ) {}

  async execute({ organizationId }: FindVoiceStatusQuery): Promise<VoiceStatusDto> {
    const providers = organizationId ? await this.registry.availableFor(organizationId) : [];
    return VoiceTranscriptionMapper.toStatus(providers, this.live.isConfigured());
  }
}
