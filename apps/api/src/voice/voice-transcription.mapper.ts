import type { VoiceStatusDto, VoiceTranscriptionDto } from '@oppenheimer/shared';
import type { SpeechProvider } from './application/speech-provider.port';
import type { HeardClip } from './application/voice-transcription.resolver';

/** What dictation answers: a transcription, and whether a workspace can dictate at all. */
export class VoiceTranscriptionMapper {
  static toResponse(heard: HeardClip, polished: string | null): VoiceTranscriptionDto {
    return {
      text: polished ?? heard.raw,
      raw: heard.raw,
      provider: heard.provider,
      polished: polished !== null,
    };
  }

  static toStatus(providers: readonly SpeechProvider[]): VoiceStatusDto {
    return { available: providers.length > 0, providers: providers.map((provider) => provider.id) };
  }
}
