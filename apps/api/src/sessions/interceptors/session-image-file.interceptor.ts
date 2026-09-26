import { SESSION_IMAGE_MAX_BYTES } from '@oppenheimer/shared/protocol';
import { FileUploadInterceptor } from '../../profile/interceptors/file-upload.interceptor';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * A pasted image's upload: the `file` field, the image cap, and this
 * module's refusals. The multer handling itself is shared with the avatar.
 */
export const SessionImageFileInterceptor = FileUploadInterceptor({
  field: 'file',
  maxBytes: SESSION_IMAGE_MAX_BYTES,
  tooLarge: SessionErrors.IMAGE_TOO_LARGE,
  missing: SessionErrors.IMAGE_MISSING,
});
