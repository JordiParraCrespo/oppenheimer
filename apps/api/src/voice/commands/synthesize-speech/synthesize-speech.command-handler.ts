import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { VoiceErrors } from '../../domain/voice.errors';
import {
  oggOpusSeconds,
  SPEECH_MAX_SECONDS,
  SPEECH_TEXT_MAX_CHARS,
} from '../../domain/voice-synthesis.policy';
import type { SpeechSynthesisPort } from '../../infrastructure/speech-synthesis.port';
import { SPEECH_SYNTHESIS } from '../../voice.di-tokens';
import { type SpokenAudio, SynthesizeSpeechCommand } from './synthesize-speech.command';

/**
 * Speaks a short text on the deployment's text-to-speech server, for a bot's
 * WhatsApp voice note: the text judged first (`VOICE_011`), the answer judged
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
  constructor(@Inject(SPEECH_SYNTHESIS) private readonly speech: SpeechSynthesisPort) {}

  async execute(command: SynthesizeSpeechCommand): Promise<SpokenAudio> {
    requireOrganization(command.organizationId);
    const text = command.text.trim();
    if (!text || text.length > SPEECH_TEXT_MAX_CHARS) {
      throw new AppError(VoiceErrors.SYNTHESIS_TEXT_INVALID, {
        detail: `Speak 1 to ${SPEECH_TEXT_MAX_CHARS} characters; this is ${text.length}.`,
      });
    }
    if (!this.speech.isConfigured()) throw new AppError(VoiceErrors.SYNTHESIS_NOT_CONFIGURED);

    const data = await this.speech.synthesize(text);
    const seconds = oggOpusSeconds(data);
    if (seconds === null) {
      throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
        detail: 'The text-to-speech server did not answer Ogg/Opus audio.',
      });
    }
    if (seconds > SPEECH_MAX_SECONDS) {
      throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
        detail: `The speech runs ${seconds} seconds; a voice note runs ${SPEECH_MAX_SECONDS} at most.`,
      });
    }
    return { data, mimetype: 'audio/ogg; codecs=opus', seconds };
  }
}
