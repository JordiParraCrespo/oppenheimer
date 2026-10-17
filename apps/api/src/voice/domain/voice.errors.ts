import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const VoiceErrors = {
  /** A dictation is the caller's in their workspace, and nobody has none. */
  NO_ACTIVE_ORGANIZATION: {
    code: 'VOICE_001',
    message: 'Dictation needs an active workspace',
    httpStatus: 400,
  },
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
   * Nobody to hear it: the workspace is not signed in to ChatGPT and the
   * deployment has no speech-to-text server of its own.
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
} as const satisfies Record<string, ErrorDefinition>;
