import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const VoiceErrors = {
  TRANSCRIBE_FAILED: {
    code: 'VOICE_CLIENT_001',
    message: 'Failed to transcribe the recording',
  },
  STATUS_FAILED: {
    code: 'VOICE_CLIENT_002',
    message: 'Failed to read whether dictation is available',
  },
  SETTINGS_FAILED: {
    code: 'VOICE_CLIENT_003',
    message: 'Failed to read the voice settings',
  },
  SAVE_SETTINGS_FAILED: {
    code: 'VOICE_CLIENT_004',
    message: 'Failed to save the voice settings',
  },
} as const satisfies Record<string, ErrorDefinition>;
