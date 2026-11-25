import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { VoiceSynthesisResolver } from '../../application/voice-synthesis.resolver';
import type { VoiceSettingsRepositoryPort } from '../../database/voice-settings.repository.port';
import { VoiceErrors } from '../../domain/voice.errors';
import { SPEECH_MAX_SECONDS, SPEECH_TEXT_MAX_CHARS } from '../../domain/voice-synthesis.policy';
import { VOICE_SETTINGS_REPOSITORY } from '../../voice.di-tokens';
import { type SpokenAudio, SynthesizeSpeechCommand } from './synthesize-speech.command';

/**
 * Speaks a short text for a bot's voice note, on the provider, model and
 * voice the workspace chose (Settings → Model providers), else the first it
 * has (`VoiceSynthesisResolver`): the text judged first (`VOICE_011`), the answer judged
 * by its bytes after (Ogg/Opus, no longer than a voice note runs), so what
 * reaches the host is a note the phone plays. Nothing is kept: the audio
 * lives in memory for this call and is never written to disk.
 *
 * It answers the audio rather than an id, as a dictation answers its
 * transcript: the result is about this request, not an aggregate.
 */
@CommandHandler(SynthesizeSpeechCommand)
export class SynthesizeSpeechCommandHandler
  implements ICommandHandler<SynthesizeSpeechCommand, SpokenAudio>
{
  constructor(
    private readonly speech: VoiceSynthesisResolver,
    @Inject(VOICE_SETTINGS_REPOSITORY) private readonly settings: VoiceSettingsRepositoryPort,
  ) {}

  async execute(command: SynthesizeSpeechCommand): Promise<SpokenAudio> {
    requireOrganization(command.organizationId);
    const text = command.text.trim();
    if (!text || text.length > SPEECH_TEXT_MAX_CHARS) {
      throw new AppError(VoiceErrors.SYNTHESIS_TEXT_INVALID, {
        detail: `Speak 1 to ${SPEECH_TEXT_MAX_CHARS} characters; this is ${text.length}.`,
      });
    }

    const settings = await this.settings.find(command.organizationId);
    const { audio: data, seconds } = await this.speech.speak(
      command.organizationId,
      text,
      new Date(),
      {
        provider: settings.synthesisProvider,
        model: settings.synthesisModel,
        voice: settings.synthesisVoice,
      },
    );
    if (seconds > SPEECH_MAX_SECONDS) {
      throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
        detail: `The speech runs ${seconds} seconds; a voice note runs ${SPEECH_MAX_SECONDS} at most.`,
      });
    }
    return { data, mimetype: 'audio/ogg; codecs=opus', seconds };
  }
}
