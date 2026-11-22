import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const VoiceErrors = {
  AUDIO_MISSING: {
    code: 'VOICE_002',
    message: 'No audio was sent',
    httpStatus: 400,
  },
  AUDIO_TOO_LARGE: {
    code: 'VOICE_003',
    message: 'The recording is too long',
    httpStatus: 413,
  },
  /** Judged by the bytes: the console sends 16-bit PCM WAV and nothing else is taken. */
  UNSUPPORTED_AUDIO: {
    code: 'VOICE_004',
    message: 'The recording is not 16-bit PCM WAV',
    httpStatus: 415,
  },
  /**
   * Nobody to hear it: no ChatGPT sign-in, no OpenAI, Groq or ElevenLabs key,
   * and no speech-to-text server on the deployment.
   */
  NOT_CONFIGURED: {
    code: 'VOICE_005',
    message: 'Dictation is not set up for this workspace',
    httpStatus: 409,
  },
  /** The provider was unreachable, refused the clip, or answered something that is not a transcript. */
  PROVIDER_UNAVAILABLE: {
    code: 'VOICE_006',
    message: 'The speech-to-text provider could not transcribe the recording',
    httpStatus: 502,
  },
  RATE_LIMITED: {
    code: 'VOICE_007',
    message: 'The speech-to-text provider is rate limiting this workspace',
    httpStatus: 429,
  },
  /** Nobody to speak it: no OpenAI or ElevenLabs key, and no deployment server (`VOICE_TTS_*`). */
  SYNTHESIS_NOT_CONFIGURED: {
    code: 'VOICE_008',
    message: 'Speech synthesis is not set up for this workspace',
    httpStatus: 409,
  },
  /** The provider was unreachable, refused the text, or answered something that is not Ogg/Opus speech. */
  SYNTHESIS_UNAVAILABLE: {
    code: 'VOICE_009',
    message: 'The text-to-speech provider could not speak the text',
    httpStatus: 502,
  },
  SYNTHESIS_RATE_LIMITED: {
    code: 'VOICE_010',
    message: 'The text-to-speech provider is rate limiting this workspace',
    httpStatus: 429,
  },
  /** Empty, or longer than one voice note says (`SPEECH_TEXT_MAX_CHARS`). */
  SYNTHESIS_TEXT_INVALID: {
    code: 'VOICE_011',
    message: 'That text cannot be spoken as one voice note',
    httpStatus: 422,
  },
} as const satisfies Record<string, ErrorDefinition>;
