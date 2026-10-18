import { VOICE_AUDIO_MAX_BYTES } from '@oppenheimer/shared';
import { FileUploadInterceptor } from '../../profile/interceptors/file-upload.interceptor';
import { VoiceErrors } from '../domain/voice.errors';

/**
 * A dictation's upload: the `audio` field, the cap, and this module's
 * refusals. The multer handling itself is shared with the avatar and session
 * files.
 */
export const VoiceAudioInterceptor = FileUploadInterceptor({
  field: 'audio',
  maxBytes: VOICE_AUDIO_MAX_BYTES,
  tooLarge: VoiceErrors.AUDIO_TOO_LARGE,
  missing: VoiceErrors.AUDIO_MISSING,
});
