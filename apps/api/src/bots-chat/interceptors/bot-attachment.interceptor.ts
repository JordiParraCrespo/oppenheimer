import { BOT_IMAGE_MAX_BYTES } from '@oppenheimer/shared';
import { BotErrors } from '../../bots/domain/bots.errors';
import { FileUploadInterceptor } from '../../profile/interceptors/file-upload.interceptor';

/**
 * An image's upload to a bot's chat: the `file` field, the cap, and the bots
 * catalog's refusals. The multer handling itself is shared with the avatar.
 */
export const BotAttachmentInterceptor = FileUploadInterceptor({
  field: 'file',
  maxBytes: BOT_IMAGE_MAX_BYTES,
  tooLarge: BotErrors.ATTACHMENT_TOO_LARGE,
  missing: BotErrors.ATTACHMENT_TYPE_UNSUPPORTED,
});
