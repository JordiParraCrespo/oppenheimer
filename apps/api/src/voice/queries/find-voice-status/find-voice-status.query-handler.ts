import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { VoiceStatusDto } from '@oppenheimer/shared';
import { SpeechProviderRegistry } from '../../application/speech-provider.registry';
import { VoiceTranscriptionMapper } from '../../voice-transcription.mapper';
import { FindVoiceStatusQuery } from './find-voice-status.query';

/**
 * Whether the workspace can dictate, and on which providers in the order a
 * dictation tries them: the registry's own answer, so a provider added there
 * shows the console's mic with no change here or in the console.
 */
@QueryHandler(FindVoiceStatusQuery)
export class FindVoiceStatusQueryHandler
  implements IQueryHandler<FindVoiceStatusQuery, VoiceStatusDto>
{
  constructor(private readonly registry: SpeechProviderRegistry) {}

  async execute({ organizationId }: FindVoiceStatusQuery): Promise<VoiceStatusDto> {
    const providers = organizationId ? await this.registry.availableFor(organizationId) : [];
    return VoiceTranscriptionMapper.toStatus(providers);
  }
}
