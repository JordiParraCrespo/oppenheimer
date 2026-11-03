import type {
  VoiceLiveSessionDto,
  VoiceStatusDto,
  VoiceTranscriptionDto,
} from '@oppenheimer/shared';
import type { SpeechProvider } from './application/speech-provider.port';
import type { HeardClip } from './application/voice-transcription.resolver';
import type { LiveSpeechTicket } from './infrastructure/speech-to-text.port';

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

  /** `live` only where someone can also hear the recording when it stops: the live words are a preview of that. */
  static toStatus(providers: readonly SpeechProvider[], liveConfigured: boolean): VoiceStatusDto {
    const available = providers.length > 0;
    return {
      available,
      providers: providers.map((provider) => provider.id),
      live: available && liveConfigured,
    };
  }

  static toLiveSession(ticket: LiveSpeechTicket): VoiceLiveSessionDto {
    return { url: ticket.url, secret: ticket.secret, expiresAt: ticket.expiresAt.toISOString() };
  }
}
