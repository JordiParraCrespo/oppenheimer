import type { VoiceTranscriptionDto } from '@oppenheimer/shared';
import type { HeardClip } from './application/voice-transcription.resolver';

/** What a dictation answers, from what was heard and what the polish made of it. */
export class VoiceTranscriptionMapper {
  static toResponse(heard: HeardClip, polished: string | null): VoiceTranscriptionDto {
    return {
      text: polished ?? heard.raw,
      raw: heard.raw,
      provider: heard.provider,
      polished: polished !== null,
    };
  }
}
