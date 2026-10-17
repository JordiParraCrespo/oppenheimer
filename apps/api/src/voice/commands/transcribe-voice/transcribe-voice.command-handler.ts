import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { type VoiceTranscriptionDto, vocabularyTerms } from '@oppenheimer/shared';
import { VoicePolishResolver } from '../../application/voice-polish.resolver';
import { VoiceTranscriptionResolver } from '../../application/voice-transcription.resolver';
import { VoiceErrors } from '../../domain/voice.errors';
import { isPcmWav } from '../../domain/voice-audio.policy';
import { VoiceTranscriptionMapper } from '../../voice-transcription.mapper';
import { TranscribeVoiceCommand } from './transcribe-voice.command';

/**
 * One dictation (`product/next-steps/voice.md`): the clip is judged by its
 * bytes, heard by the workspace's ChatGPT sign-in or the deployment's own
 * speech server, then tidied into writing. Nothing is kept: the audio and the
 * transcript live for this request, and what the person sends afterwards is
 * whatever they keep of it.
 *
 * It answers the transcript rather than an id, like the session attachment
 * upload: the result is about this request, not an aggregate to read back.
 */
@CommandHandler(TranscribeVoiceCommand)
export class TranscribeVoiceCommandHandler
  implements ICommandHandler<TranscribeVoiceCommand, VoiceTranscriptionDto>
{
  constructor(
    private readonly transcription: VoiceTranscriptionResolver,
    private readonly polish: VoicePolishResolver,
  ) {}

  async execute(command: TranscribeVoiceCommand): Promise<VoiceTranscriptionDto> {
    if (!command.organizationId) throw new AppError(VoiceErrors.NO_ACTIVE_ORGANIZATION);
    if (!command.audio?.length) throw new AppError(VoiceErrors.AUDIO_MISSING);
    if (!isPcmWav(command.audio)) {
      throw new AppError(VoiceErrors.UNSUPPORTED_AUDIO, {
        detail: 'Send the recording as a WAV file of 16-bit PCM, mono or stereo.',
      });
    }

    const heard = await this.transcription.hear(
      command.organizationId,
      { data: command.audio, language: command.language },
      new Date(),
    );
    const polished = heard.raw
      ? await this.polish.polish(heard.raw, vocabularyTerms(command.vocabulary), heard.chatgpt)
      : null;
    return VoiceTranscriptionMapper.toResponse(heard, polished);
  }
}
