import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { type VoiceLiveSessionDto, vocabularyTerms } from '@oppenheimer/shared';
import { SpeechProviderRegistry } from '../../application/speech-provider.registry';
import { VoiceErrors } from '../../domain/voice.errors';
import { speechNames } from '../../domain/voice-speech.policy';
import type { LiveSpeechPort } from '../../infrastructure/speech-to-text.port';
import { LIVE_SPEECH } from '../../voice.di-tokens';
import { VoiceTranscriptionMapper } from '../../voice-transcription.mapper';
import { StartVoiceLiveCommand } from './start-voice-live.command';

/**
 * One live dictation (`product/next-steps/voice.md`): a realtime
 * transcription session for the console to stream the recording into while
 * it runs, so the words show as they are said. It is a preview: the text the
 * field keeps is still the recording's transcription when it stops
 * (`POST /voice/transcriptions`), so a workspace nobody can hear that way
 * gets no live session either (`VOICE_005`). Nothing is kept.
 */
@CommandHandler(StartVoiceLiveCommand)
export class StartVoiceLiveCommandHandler
  implements ICommandHandler<StartVoiceLiveCommand, VoiceLiveSessionDto>
{
  constructor(
    private readonly registry: SpeechProviderRegistry,
    @Inject(LIVE_SPEECH) private readonly live: LiveSpeechPort,
  ) {}

  async execute(command: StartVoiceLiveCommand): Promise<VoiceLiveSessionDto> {
    requireOrganization(command.organizationId);
    if (!this.live.isConfigured()) throw new AppError(VoiceErrors.LIVE_NOT_CONFIGURED);
    const providers = await this.registry.availableFor(command.organizationId);
    if (providers.length === 0) throw new AppError(VoiceErrors.NOT_CONFIGURED);

    const ticket = await this.live.open({
      keywords: speechNames(vocabularyTerms(command.vocabulary)),
      language: command.language,
    });
    return VoiceTranscriptionMapper.toLiveSession(ticket);
  }
}
