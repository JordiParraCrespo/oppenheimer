import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const VoiceErrors = {
  TRANSCRIBE_FAILED: {
    code: 'VOICE_CLIENT_001',
    message: 'Failed to transcribe the recording',
  },
} as const satisfies Record<string, ErrorDefinition>;
